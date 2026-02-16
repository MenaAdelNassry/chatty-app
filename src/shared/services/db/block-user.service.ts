import mongoose from 'mongoose';
import { UserModel } from '@user/models/user.schema';
import { BlockModel } from '@follower/models/block.model';
import { FollowerModel } from '@follower/models/follower.model';
import { ServerError } from '@global/helpers/error-handler';
import { IFollowerData } from '@follower/interfaces/follower.interface';
import { notificationQueue } from '@service/queues/notification.queue';

class BlockUserService {
  public async blockUser(userId: string, blockedUserId: string): Promise<void> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const blockedUserObjectId = new mongoose.Types.ObjectId(blockedUserId);

    try {
      // 1. Create the Block Document (The Source of Truth)
      // If unique index exists, this ensures we don't block twice.
      await BlockModel.create({
        blockerId: userObjectId,
        blockedId: blockedUserObjectId
      });

      // 2. Clean up Relationships (Parallel Check)
      // We check both directions: A -> B AND B -> A
      const [followRes1, followRes2] = await Promise.all([
        FollowerModel.findOneAndDelete({ followerId: userObjectId, followeeId: blockedUserObjectId }),
        FollowerModel.findOneAndDelete({ followerId: blockedUserObjectId, followeeId: userObjectId })
      ]);

      // 3. Update Counters ONLY if a relationship actually existed
      // This prevents "Ghost Decrements" (Negative counts).
      const promises: Promise<any>[] = [];

      // If 'userId' was following 'blockedUserId', decrement counts
      if (followRes1) {
        promises.push(UserModel.updateOne({ _id: userObjectId }, { $inc: { followingCount: -1 } }));
        promises.push(UserModel.updateOne({ _id: blockedUserObjectId }, { $inc: { followersCount: -1 } }));
      }

      // If 'blockedUserId' was following 'userId', decrement counts
      if (followRes2) {
        promises.push(UserModel.updateOne({ _id: userObjectId }, { $inc: { followersCount: -1 } }));
        promises.push(UserModel.updateOne({ _id: blockedUserObjectId }, { $inc: { followingCount: -1 } }));
      }

      // Execute all updates in parallel
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // 4. CLEAN UP NOTIFICATIONS
      notificationQueue.addNotificationJob('deleteNotification', {
        userFrom: userId,
        userTo: blockedUserId,
        deleteBlockInteraction: true
      });
    } catch (error: any) {
      // 🛡️ IDEMPOTENCY: Ignore Duplicate Key Error (Code 11000)
      if (error.code === 11000) {
        return;
      }
      throw new ServerError('Server error. Try again.');
    }
  }

  public async unblockUser(userId: string, blockedUserId: string): Promise<void> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const blockedUserObjectId = new mongoose.Types.ObjectId(blockedUserId);

    // Unblocking is simple: Just remove the block record.
    await BlockModel.deleteOne({
      blockerId: userObjectId,
      blockedId: blockedUserObjectId
    });
  }

  public async getBlockedUsers(userId: string, skip: number, limit: number): Promise<{ blockedUsers: IFollowerData[]; total: number }> {
    const result = await BlockModel.aggregate([
      // 1. Match: Find documents where the current user is the blocker
      { $match: { blockerId: new mongoose.Types.ObjectId(userId) } },

      // 2. Facet: Run two pipelines in parallel (One for data, one for count)
      {
        $facet: {
          // Pipeline A: Retrieve paginated data
          blockedUsers: [
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: limit },

            // A.1. Lookup: Get the BLOCKED user's details from User collection
            { $lookup: { from: 'User', localField: 'blockedId', foreignField: '_id', as: 'blockedUser' } },
            { $unwind: '$blockedUser' },

            // A.2. Lookup: Get Auth details (username, email, etc.) from Auth collection
            { $lookup: { from: 'Auth', localField: 'blockedUser.authId', foreignField: '_id', as: 'authId' } },
            { $unwind: '$authId' },

            // A.3. Project: Format the output structure
            {
              $project: {
                _id: '$blockedUser._id',
                username: '$authId.username',
                uId: '$authId.uId',
                avatarColor: '$authId.avatarColor',
                profilePicture: '$blockedUser.profilePicture',
                postsCount: '$blockedUser.postsCount',
                followersCount: '$blockedUser.followersCount',
                followingCount: '$blockedUser.followingCount'
              }
            }
          ],

          // Pipeline B: Count total documents (ignoring pagination limits)
          total: [{ $count: 'count' }]
        }
      }
    ]);

    // The aggregation returns an array with a single object containing the facet results
    const finalResult = result[0];

    return {
      blockedUsers: finalResult.blockedUsers,
      // Handle case where total array is empty (i.e., no blocked users found)
      total: finalResult.total.length > 0 ? finalResult.total[0].count : 0
    };
  }

  public async getExclusionBlockIds(userId: string): Promise<string[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const blocks = await BlockModel.find({
      $or: [{ blockerId: userObjectId }, { blockedId: userObjectId }]
    }).select('blockerId blockedId');

    const blockIds: string[] = [];

    blocks.forEach((doc) => {
      if (doc.blockerId.toString() === userId) {
        blockIds.push(doc.blockedId.toString());
      } else {
        blockIds.push(doc.blockerId.toString());
      }
    });

    return [...new Set(blockIds)];
  }
}

export const blockUserService: BlockUserService = new BlockUserService();
