import { ObjectId } from 'mongodb';
import { DoneCallback, Job } from 'bull';
import { config } from '@root/config';
import Logger from 'bunyan';
import { notificationService } from '@service/db/notification.service';
import { UserCache } from '@service/redis/user.cache';
import { userService } from '@service/db/user.service';
import { NotificationModel } from '@notification/models/notification.model';
import { socketIONotificationObject } from '@socket/notification';
import { emailQueue } from '@service/queues/email.queue';
import { INotificationSettings } from '@user/interfaces/user.interface';
import { NotificationSystemHelper } from '@global/helpers/notification.helper';
import { NotFoundError } from '@global/helpers/error-handler';

const log: Logger = config.createLogger('notificationWorker');
const usercache: UserCache = new UserCache();
type NotificationType = keyof INotificationSettings;

class NotificationWorker {
  updateNotification = async (job: Job, done: DoneCallback): Promise<void> => {
    try {
      const { createdItemId, key, reaction, userId } = job.data;

      // Mark as read
      if (key) {
        await notificationService.updateNotification(key);
      }

      // Mark All as read
      else if(userId) {
        await notificationService.markAllNotificationsAsRead(userId);
      }

      // Handle Update Reaction Case
      else if (createdItemId && reaction) {
        // Update first
        await NotificationModel.updateOne({ createdItemId }, { createdAt: new Date().toISOString(), reaction, read: false });

        // Then aggregate with population
        const [notification] = await NotificationModel.aggregate([
          { $match: { createdItemId: new ObjectId(createdItemId) } },
          ...this.aggregateProject()
        ]);

        socketIONotificationObject.emit('update notification', { notification }, { userTo: `${notification.userTo}` });
      }

      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  };

  async deleteNotification(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, userFrom, userTo, deleteBlockInteraction, createdItemId } = job.data;

      // Senario 1 (for blocking)
      if (deleteBlockInteraction && userFrom && userTo) {
        // 1. DB Cleanup
        await notificationService.deleteNotificationsBetweenUsers(userFrom, userTo);

        // 2. Socket Emit (Clean Logic) 📡
        socketIONotificationObject.emit('delete notification', { userFrom: userTo }, { userTo: userFrom });
        socketIONotificationObject.emit('delete notification', { userFrom: userFrom }, { userTo: userTo });
      }

      // Senario 2 for (comments | reactions | follows)
      else if (createdItemId) {
        const notification = await NotificationModel.findOneAndDelete({ createdItemId });

        if (notification) {
          socketIONotificationObject.emit('delete notification', { notification }, { userTo: `${notification.userTo}` });
        }
      }

      // Senario 3 for (usual button for delete notification)
      else if (key) {
        await NotificationModel.deleteOne({ _id: key });
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
      done(new NotFoundError('User not found'));
      return;
    }

    // 2. Create Notification in MongoDB 💾
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
      read: false,
    });
    await notificationModel.save();

    // 3. Send Socket Event (Optimized) ⚡
    const notificationSocketData = {
      ...notificationModel.toJSON(),
      userFrom: {
        username: userFromData.username,
        profilePicture: userFromData.profilePicture,
        avatarColor: userFromData.avatarColor,
        _id: userFromData._id
      }
    };

    socketIONotificationObject.emit('insert notification', notificationSocketData, { userTo });

    // 4. Check Notification Settings 🛡️
    if (!userToData.notifications[notificationType]) {
      done(null, job.data);
      return;
    }

    // 5. Send Email
    const { subject, header } = NotificationSystemHelper.getEmailMetadata(notificationType, userFromData.username!);
    emailQueue.addNotificationEmail(notificationType, {
      receiverEmail: userToData.email!,
      subject,
      username: userToData.username!,
      header,
      message
    });

    job.progress(100);
    done(null, job.data);
  }

  // ---------------------------------------------------------
  // 🔒 Private Methods (Helpers)
  // ---------------------------------------------------------
  private aggregateProject(): any[] {
    return [
      { $lookup: { from: 'User', localField: 'userFrom', foreignField: '_id', as: 'userFrom' } },
      { $unwind: '$userFrom' },
      { $lookup: { from: 'Auth', localField: 'userFrom.authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      {
        $project: {
          _id: 1,
          message: 1,
          comment: 1,
          createdAt: 1,
          createdItemId: 1,
          entityId: 1,
          notificationType: 1,
          gifUrl: 1,
          imgId: 1,
          imgVersion: 1,
          post: 1,
          reaction: 1,
          read: 1,
          userTo: 1,
          userFrom: {
            _id: '$userFrom._id',
            profilePicture: '$userFrom.profilePicture',
            username: '$authId.username',
            avatarColor: '$authId.avatarColor'
          }
        }
      }
    ];
  }
}

export const notificationWorker: NotificationWorker = new NotificationWorker();
