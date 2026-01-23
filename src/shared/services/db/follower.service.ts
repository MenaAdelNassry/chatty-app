import { IFollowerData } from '@follower/interfaces/follower.interface';
import { FollowerModel } from '@follower/models/follower.model';
import { UserModel } from '@user/models/user.schema';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { BadRequestError, ServerError } from '@global/helpers/error-handler';
import { BlockModel } from '@follower/models/block.model';
import { FollowerCache } from '@service/redis/follower.cache';
import { notificationQueue } from '@service/queues/notification.queue';

const followerCache: FollowerCache = new FollowerCache();

class FollowerService {
  /**
   * Main Method: Add Follower
   * Responsible for: DB Persistence + Cache Updates + Block Validation
   */
  public async addFollowerToDB(userId: string, followeeId: string, username: string, followerDocumentId: string): Promise<void> {
    if (userId === followeeId) {
      throw new BadRequestError('You cannot follow yourself.');
    }

    const followeeObjectId = new mongoose.Types.ObjectId(followeeId);
    const followerObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Validation Phase (Cache First Strategy) 🛡️
    // No DB Fallback here to maintain performance.
    const isUserBlocked = await followerCache.isUserBlockedBy(userId, followeeId);
    const isUserBlocking = await followerCache.isUserBlockedBy(followeeId, userId);
    if (isUserBlocked || isUserBlocking) {
      throw new BadRequestError('Action denied.');
    }

    try {
      // 2. Persistence Phase (MongoDB) 💾
      await FollowerModel.create({
        _id: followerDocumentId,
        followeeId: followeeObjectId,
        followerId: followerObjectId
      });

      // B. Update Counters (Parallel Execution) ⚡
      await Promise.all([
        UserModel.updateOne({ _id: followeeId }, { $inc: { followersCount: 1 } }),
        UserModel.updateOne({ _id: userId }, { $inc: { followingCount: 1 } })
      ]);

      // 3. Caching Phase (Redis Update) ⚡
      const followerCountPromise = followerCache.saveFollowerToCache(`following:${userId}`, followeeId, userId, 'followingCount');
      const followeeCountPromise = followerCache.saveFollowerToCache(`followers:${followeeId}`, userId, followeeId, 'followersCount');
      await Promise.all([followerCountPromise, followeeCountPromise]);

      notificationQueue.addNotificationJob('insertNotification', {
        userFrom: userId,
        userTo: followeeId,
        message: `${username} is now following you.`,
        notificationType: 'follows',
        entityId: userId,
        createdItemId: followerDocumentId,
        createdAt: new Date(),
      });
    } catch (error: any) {
      // 4. Idempotency Handler 🛡️
      // Error 11000 = Duplicate Key. It means the user is already following.
      // We swallow this error to make the operation idempotent (safe to retry).
      if (error.code === 11000) {
        return;
      }
      // Any other error is a real server issue.
      throw new ServerError('Server error. Try again.');
    }
  }

  /**
   * Unfollow User Method
   * Responsible for: DB Cleanup + Cache Cleanup + Removing Old Notification
   */
  public async removeFollowerFromDB(followeeId: string, followerId: string): Promise<void> {
    if (followerId === followeeId) {
      throw new BadRequestError('You cannot unfollow yourself.');
    }

    const followeeObjectId = new mongoose.Types.ObjectId(followeeId);
    const followerObjectId = new mongoose.Types.ObjectId(followerId);

    // 1. Persistence Phase (MongoDB) 💾
    // Delete the relationship document
    const deletePromise = FollowerModel.deleteOne({
      followeeId: followeeObjectId,
      followerId: followerObjectId
    });

    // Update Counters (Decrement -1) (Parallel Execution)
    const usersPromise = Promise.all([
      UserModel.updateOne({ _id: followeeId }, { $inc: { followersCount: -1 } }),
      UserModel.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } })
    ]);

    await Promise.all([deletePromise, usersPromise]);

    // 2. Caching Phase (Redis Update) ⚡
    const response1 = followerCache.removeFollowerFromCache(
      `following:${followerId}`,
      followeeId,
      followerId,
      'followingCount'
    );

    const response2 = followerCache.removeFollowerFromCache(
      `followers:${followeeId}`,
      followerId,
      followeeId,
      'followersCount'
    );

    await Promise.all([response1, response2]);

    notificationQueue.addNotificationJob('deleteNotification', {
      userFrom: followerId,
      userTo: followeeId,
      notificationType: 'follows',
    });
  }

  // Added skip and limit for Pagination
  public async getUserFollowing(userId: ObjectId, skip: number, limit: number): Promise<IFollowerData[]> {
    return await this.getFollowersData(userId, 'following', skip, limit);
  }

  // Added skip and limit for Pagination
  public async getUserFollowers(userId: ObjectId, skip: number, limit: number): Promise<IFollowerData[]> {
    return await this.getFollowersData(userId, 'followers', skip, limit);
  }

  public async getFolloweeIds(userId: string): Promise<string[]> {
    const followings = await FollowerModel.find({ followerId: userId }).select('followeeId');
    return followings.map((f) => f.followeeId.toString());
  }

  public async isAnyBlockingExist(userId1: string, userId2: string): Promise<boolean> {
    const existingBlock = await BlockModel.findOne({
      $or: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 }
      ]
    });

    return existingBlock ? true : false;
  }

  // ✅ PAGINATION IMPLEMENTED in Aggregation
  private async getFollowersData(userId: ObjectId, type: 'followers' | 'following', skip: number, limit: number): Promise<IFollowerData[]> {
    const userMatchId = type === 'following' ? 'followerId' : 'followeeId';
    const userLookupId = type === 'following' ? 'followeeId' : 'followerId';

    const result: IFollowerData[] = await FollowerModel.aggregate([
      { $match: { [userMatchId]: userId } },

      // 🚀 PERFORMANCE BOOST:
      // Sort, Skip, and Limit MUST happen BEFORE the Lookup.
      // Otherwise, you join 1M users and then throw away 999,990 of them.
      { $sort: { createdAt: -1 } }, // Sort by newest first (optional but recommended)
      { $skip: skip },
      { $limit: limit },

      { $lookup: { from: 'User', localField: userLookupId, foreignField: '_id', as: userLookupId } },
      { $unwind: `$${userLookupId}` },

      { $lookup: { from: 'Auth', localField: `${userLookupId}.authId`, foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },

      {
        $project: {
          _id: `$${userLookupId}._id`,
          uId: '$authId.uId',
          username: '$authId.username',
          avatarColor: '$authId.avatarColor',
          profilePicture: `$${userLookupId}.profilePicture`,
          postsCount: `$${userLookupId}.postsCount`,
          followersCount: `$${userLookupId}.followersCount`,
          followingCount: `$${userLookupId}.followingCount`
        }
      }
    ]);

    return result;
  }
}

export const followerService: FollowerService = new FollowerService();
