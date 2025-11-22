import mongoose from 'mongoose';
import { UserModel } from '@user/models/user.schema';

class BlockUserService {
  // -------------------------------------------------------------------------
  // TODO: 🧪 FUTURE REFACTOR & LEARNING (bulkWrite)
  //
  // Current Implementation:
  // I am using `Promise.all` to execute two separate `updateOne` commands in parallel.
  // This works perfectly fine but opens two separate network requests to MongoDB.
  //
  // Hypothesis for Optimization:
  // Since both operations target the SAME collection (UserModel), MongoDB offers
  // a `bulkWrite` method that can bundle both updates into a SINGLE network payload.
  //
  // ACTION PLAN:
  // 1. Study MongoDB `bulkWrite` syntax and behavior.
  // 2. Benchmark current `Promise.all` approach vs `bulkWrite`.
  // 3. If `bulkWrite` proves significantly faster or more efficient, refactor this block.
  // -------------------------------------------------------------------------
  public async blockUser(userId: string, blockedUserId: string): Promise<void> {
    const updateUserWhoBlocks = UserModel.updateOne(
      { _id: userId, blocked: { $ne: new mongoose.Types.ObjectId(blockedUserId) } },
      { $push: { blocked: new mongoose.Types.ObjectId(blockedUserId) } }
    );

    const updateBlockedUser = UserModel.updateOne(
      { _id: blockedUserId, blockedBy: { $ne: new mongoose.Types.ObjectId(userId) } },
      { $push: { blockedBy: new mongoose.Types.ObjectId(userId) } }
    );

    await Promise.all([updateUserWhoBlocks, updateBlockedUser]);
  }

  public async unblockUser(userId: string, blockedUserId: string): Promise<void> {
    const updateUserWhoBlocks = UserModel.updateOne({ _id: userId }, { $pull: { blocked: new mongoose.Types.ObjectId(blockedUserId) } });

    const updateBlockedUser = UserModel.updateOne({ _id: blockedUserId }, { $pull: { blockedBy: new mongoose.Types.ObjectId(userId) } });

    await Promise.all([updateUserWhoBlocks, updateBlockedUser]);
  }
}

export const blockUserService: BlockUserService = new BlockUserService();
