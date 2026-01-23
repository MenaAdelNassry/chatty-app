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

  public async getBlockedUsers(userId: string, skip: number, limit: number): Promise<IFollowerData[]> {
    const blockedUsers: IFollowerData[] = await BlockModel.aggregate([
      // 1. Match: Find docs where I am the blocker
      { $match: { blockerId: new mongoose.Types.ObjectId(userId) } },

      // 2. Sort & Pagination
      { $sort: { _id: -1 } },
      { $skip: skip },
      { $limit: limit },

      // 3. Lookup: Get the BLOCKED user's details
      { $lookup: { from: 'User', localField: 'blockedId', foreignField: '_id', as: 'blockedUser' } },
      { $unwind: '$blockedUser' },

      // 4. Lookup: Get Auth details
      { $lookup: { from: 'Auth', localField: 'blockedUser.authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },

      // 5. Project: Select only needed fields
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
    ]);

    return blockedUsers;
  }

  public async getExclusionBlockIds(userId: string): Promise<string[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const blocks = await BlockModel.find({
      $or: [
        { blockerId: userObjectId },
        { blockedId: userObjectId } 
      ]
    }).select('blockerId blockedId');

    const blockIds: string[] = [];

    blocks.forEach((doc) => {
      if (doc.blockerId.toString() === userId) {
        blockIds.push(doc.blockedId.toString());
      }
      else {
        blockIds.push(doc.blockerId.toString());
      }
    });

    return [...new Set(blockIds)];
  }
}

export const blockUserService: BlockUserService = new BlockUserService();
