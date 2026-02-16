import { INotificationDocument } from '@notification/interfaces/notification.interface';
import { NotificationModel } from '@notification/models/notification.model';
import mongoose from 'mongoose';

class NotificationService {
  // 1. Get List (For User Interface)
  public async getNotifications(userId: string): Promise<INotificationDocument[]> {
    const notifications: INotificationDocument[] = await NotificationModel.aggregate([
      { $match: { userTo: new mongoose.Types.ObjectId(userId) } },

      // ✅ Optimization: Sort & Limit FIRST before joining heavy data
      { $sort: { createdAt: -1 } },
      { $limit: 50 }, // Safety cap

      // ✅ Clean Code: Using the shared pipeline
      ...this.aggregateProject()
    ]);

    return notifications;
  }

  // 2. Get Single Notification (For Socket.IO Payload)
  public async getNotificationById(notificationId: string): Promise<INotificationDocument> {
    const notifications: INotificationDocument[] = await NotificationModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(notificationId) } },

      // ✅ Reuse same logic
      ...this.aggregateProject()
    ]);

    return notifications[0];
  }

  public async updateNotification(notificationId: string): Promise<void> {
    await NotificationModel.updateOne({ _id: notificationId }, { $set: { read: true } });
  }

  public async deleteNotification(notificationId: string): Promise<void> {
    await NotificationModel.deleteOne({ _id: notificationId });
  }

  public async deleteNotificationByIDs(userFrom: string, userTo: string, notificationType: string): Promise<INotificationDocument | null> {
    return await NotificationModel.findOneAndDelete({ userTo, userFrom, notificationType });
  }

  public async deleteNotificationsBetweenUsers(user1: string, user2: string): Promise<void> {
    await NotificationModel.deleteMany({
      $or: [
        { userFrom: user1, userTo: user2 },
        { userFrom: user2, userTo: user1 }
      ]
    });
  }

  public async markAllNotificationsAsRead(userId: string): Promise<void> {
    await NotificationModel.updateMany({ userTo: userId, read: false }, { $set: { read: true } });
  }

  // ---------------------------------------------------------
  // 🔒 Private Methods (Helpers)
  // ---------------------------------------------------------
  private aggregateProject(): any[] {
    return [
      // 1. Existing Lookups (User & Auth)
      { $lookup: { from: 'User', localField: 'userFrom', foreignField: '_id', as: 'userFrom' } },
      { $unwind: '$userFrom' },
      { $lookup: { from: 'Auth', localField: 'userFrom.authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },

      // 🔥 2. Conditional Lookup
      {
        $lookup: {
          from: 'Follower',
          let: {
            senderId: '$userFrom._id',
            receiverId: '$userTo',
            type: '$notificationType'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    // 🛑 Guard Clause
                    { $eq: ['$$type', 'follows'] },

                    { $eq: ['$followerId', '$$receiverId'] },
                    { $eq: ['$followeeId', '$$senderId'] }
                  ]
                }
              }
            }
          ],
          as: 'isFollowingDoc'
        }
      },

      // 3. Project
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
          },

          isFollowing: {
            $cond: {
              if: { $gt: [{ $size: '$isFollowingDoc' }, 0] },
              then: true,
              else: false
            }
          }
        }
      }
    ];
  }
}

export const notificationService: NotificationService = new NotificationService();
