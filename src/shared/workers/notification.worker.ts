import { DoneCallback, Job } from 'bull';
import { config } from '@root/config';
import Logger from 'bunyan';
import { notificationService } from '@service/db/notification.service';
import { UserCache } from '@service/redis/user.cache';
import { userService } from '@service/db/user.service';
import { NotificationModel } from '@notification/models/notification.model';
import { socketIONotificationObject } from '@socket/notification';
import { emailQueue } from '@service/queues/email.queue';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { INotificationSettings } from '@user/interfaces/user.interface';
import { NotificationSystemHelper } from '@global/helpers/notification.helper';

const log: Logger = config.createLogger('notificationWorker');
const usercache: UserCache = new UserCache();
type NotificationType = keyof INotificationSettings;

class NotificationWorker {
  async updateNotification(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key } = job.data;
      await notificationService.updateNotification(key);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }

  async deleteNotification(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, userFrom, userTo, notificationType, deleteBlockInteraction } = job.data;

      // Senario 1
      if (deleteBlockInteraction && userFrom && userTo) {
        // 1. DB Cleanup
        await notificationService.deleteNotificationsBetweenUsers(userFrom, userTo);

        // 2. Socket Emit (Clean Logic) 📡
        socketIONotificationObject.emit('delete notification', { userFrom: userTo }, { userTo: userFrom });
        socketIONotificationObject.emit('delete notification', { userFrom: userFrom }, { userTo: userTo });
      }

      // Senario 2
      else if (userFrom && userTo && notificationType) {
        await notificationService.deleteNotificationByIDs(userFrom, userTo, notificationType);
        socketIONotificationObject.emit('delete notification', { userTo, userFrom, notificationType }, { userTo });
      }

      // Senario 3
      else if (key) {
        await NotificationModel.deleteOne({ _id: key });
        socketIONotificationObject.emit('delete notification', { _id: key }, { userTo });
      }

      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async insertNotification(job: Job, done: DoneCallback): Promise<void> {
    const { userFrom, userTo, message, entityId, createdItemId, createdAt } = job.data;
    const { comment, post, imgId, imgVersion, gifUrl, reaction } = job.data;

    const notificationType: NotificationType = job.data.notificationType;

    // 1. Get User Data (Receiver & Sender)
    let [userToData, userFromData] = await Promise.all([usercache.getUserFromCache(userTo), usercache.getUserFromCache(userFrom)]);

    // Fallback to DB if Cache Miss
    if (!userToData) userToData = await userService.getUserById(userTo);
    if (!userFromData) userFromData = await userService.getUserById(userFrom);

    if (!userToData || !userFromData) {
      done(new Error('User not found'));
      return;
    }

    // 2. Check Notification Settings 🛡️
    if (!userToData.notifications[notificationType]) {
      done(null, job.data);
      return;
    }

    // 3. Create Notification in MongoDB 💾
    const notificationModel = new NotificationModel({
      userFrom,
      userTo,
      message,
      notificationType,
      entityId,
      createdItemId,
      createdAt,
      comment: comment || '',
      post: post || '',
      imgId: imgId || '',
      imgVersion: imgVersion || '',
      gifUrl: gifUrl || '',
      reaction: reaction || '',
      read: false
    });
    await notificationModel.save();

    // 4. Send Socket Event (Optimized) ⚡
    const notificationSocketData = {
      ...notificationModel.toJSON(),
      userFrom: {
        username: userFromData.username,
        profilePicture: userFromData.profilePicture,
        avatarColor: userFromData.avatarColor,
        uId: userFromData.uId
      }
    };

    socketIONotificationObject.emit('insert notification', notificationSocketData, { userTo });

    // 5. Send Email
    const { subject, header } = NotificationSystemHelper.getEmailMetadata(notificationType, userFromData.username!);
    const templateParams = {
      username: userToData.username!,
      message,
      header
    };

    const template = notificationTemplate.notificationTemplate(templateParams);

    emailQueue.addEmailJob('followersEmail', {
      receiverEmail: userToData.email!,
      template,
      subject
    });

    job.progress(100);
    done(null, job.data);
  }
}

export const notificationWorker: NotificationWorker = new NotificationWorker();
