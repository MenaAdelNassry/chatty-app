import { IFollowerData } from '@follower/interfaces/follower.interface';
import { FollowerModel } from '@follower/models/follower.model';
import { INotificationDocument, INotificationTemplate } from '@notification/interfaces/notification.interface';
import { NotificationModel } from '@notification/models/notification.model';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { emailQueue } from '@service/queues/email.queue';
import { UserCache } from '@service/redis/user.cache';
import { socketIONotificationObject } from '@socket/notification';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { userService } from './user.service';

const userCache: UserCache = new UserCache();

class FollowerService {
  public async addFollowerToDB(userId: string, followeeId: string, username: string, followerDocumentId: ObjectId): Promise<void> {
    const followeeObjectId: ObjectId = new mongoose.Types.ObjectId(followeeId);
    const followerObjectId: ObjectId = new mongoose.Types.ObjectId(userId);

    const following = await FollowerModel.create({
      _id: followerDocumentId,
      followeeId: followeeObjectId,
      followerId: followerObjectId
    });

    // -------------------------------------------------------------------------
    // TODO: 🧪 PERFORMANCE BENCHMARK (Sequential vs Parallel)
    //
    // Current Implementation:
    // We are using sequential 'await' (Serial Execution).
    // - Pros: Safer flow (if creation fails, we don't attempt updates).
    // - Cons: Higher Latency (Total Time = Create Time + Update1 Time + Update2 Time).
    //
    // FUTURE EXPERIMENT:
    // Refactor this block to use `Promise.all([create, update1, update2])`.
    // - Goal: Measure if parallel execution significantly improves response time.
    // - Challenge: Analyze error handling (e.g., what if creating the follower succeeds but updating the count fails?).
    // -------------------------------------------------------------------------
    await UserModel.updateOne({ _id: followeeId }, { $inc: { followersCount: 1 } });
    await UserModel.updateOne({ _id: userId }, { $inc: { followingCount: 1 } });

    let followeeUserDocument: IUserDocument | null = await userCache.getUserFromCache(followeeId);
    followeeUserDocument = followeeUserDocument ? followeeUserDocument : await userService.getUserById(followeeId);

    if (followeeUserDocument?.notifications.follows && userId !== followeeId) {
      const notificationModel: INotificationDocument = new NotificationModel();
      const notifications = await notificationModel.insertNotification({
        userFrom: userId,
        userTo: followeeId,
        message: `${username} is now following you.`,
        notificationType: 'follows',
        entityId: new mongoose.Types.ObjectId(userId),
        createdItemId: new mongoose.Types.ObjectId(following._id),
        createdAt: new Date(),
        comment: '',
        post: '',
        imgId: '',
        imgVersion: '',
        gifUrl: '',
        reaction: ''
      });

      socketIONotificationObject.emit('insert notification', notifications, { userTo: followeeId });

      const templateParams: INotificationTemplate = {
        username: followeeUserDocument.username!,
        message: `${username} is now following you.`,
        header: 'Follower Notification'
      };

      const template: string = notificationTemplate.notificationTemplate(templateParams);
      emailQueue.addEmailJob('followersEmail', {
        receiverEmail: followeeUserDocument.email!,
        template,
        subject: `${username} is now following you.`
      });
    }
  }

  public async removeFollowerFromDB(followeeId: string, followerId: string): Promise<void> {
    const followeeObjectId: ObjectId = new mongoose.Types.ObjectId(followeeId);
    const followerObjectId: ObjectId = new mongoose.Types.ObjectId(followerId);

    // -------------------------------------------------------------------------
    // TODO: ⚠️ TECHNICAL DEBT (Performance & Data Integrity)
    //
    // 1. Performance (Sequential Execution):
    //    We are awaiting DB writes one by one. Refactor to use `Promise.all`
    //    to execute both updates in parallel for faster response time.
    //
    // 2. Data Integrity (Negative Counts):
    //    Using `$inc: -1` blindly can lead to negative follower counts (e.g., -1)
    //    if the database state was already corrupted or 0.
    //
    //    FUTURE FIX:
    //    - Use MongoDB conditional updates to ensure count never goes below 0.
    //    - Example: { $inc: { followersCount: -1 }, $max: { followersCount: 0 } } (Available in newer Mongo versions)
    //    - Or query logic: { _id: followeeId, followersCount: { $gt: 0 } }
    // -------------------------------------------------------------------------
    await FollowerModel.deleteOne({
      followeeId: followeeObjectId,
      followerId: followerObjectId
    });

    await UserModel.updateOne({ _id: followeeId }, { $inc: { followersCount: -1 } });
    await UserModel.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } });
  }

  public async getUserFollowing(userId: ObjectId): Promise<IFollowerData[]> {
    return await this.getFollowersData(userId, 'following');
  }

  public async getUserFollowers(userId: ObjectId): Promise<IFollowerData[]> {
    return await this.getFollowersData(userId, 'followers');
  }

  public async getFolloweeIds(userId: string): Promise<string[]> {
    const followings = await FollowerModel.find({ followerId: userId }).select('followeeId');

    return followings.map((f) => f.followeeId.toString());
  }

  private async getFollowersData(userId: ObjectId, type: 'followers' | 'following'): Promise<IFollowerData[]> {
    const userMatchId = type === 'following' ? 'followerId' : 'followeeId';
    const userLookupId = type === 'following' ? 'followeeId' : 'followerId';

    const result: IFollowerData[] = await FollowerModel.aggregate([
      { $match: { [userMatchId]: userId } },

      { $lookup: { from: 'User', localField: userLookupId, foreignField: '_id', as: userLookupId } },
      { $unwind: `$${userLookupId}` },

      { $lookup: { from: 'Auth', localField: `${userLookupId}.authId`, foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },

      {
        $addFields: {
          _id: `$${userLookupId}._id`,
          username: '$authId.username',
          uId: '$authId.uId',
          avatarColor: '$authId.avatarColor',
          profilePicture: `$${userLookupId}.profilePicture`,
          postsCount: `$${userLookupId}.postsCount`,
          followersCount: `$${userLookupId}.followersCount`,
          followingCount: `$${userLookupId}.followingCount`,
          userProfile: `$${userLookupId}`
        }
      },

      {
        $project: {
          authId: 0,
          followerId: 0,
          followeeId: 0,
          createdAt: 0,
          __v: 0
        }
      }
    ]);

    return result;
  }
}

export const followerService: FollowerService = new FollowerService();
