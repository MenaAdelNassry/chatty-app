import { Request, Response } from "express";
import HTTP_STATUS from 'http-status-codes';
import { FollowerCache } from "@service/redis/follower.cache";
import { blockedUserQueue } from "@service/queues/blocked.queue";
import { objectIdSchema } from "@global/helpers/joi.schema";
import { BadRequestError } from "@global/helpers/error-handler";
import { blockUserService } from "@service/db/block-user.service";

const followerCache: FollowerCache = new FollowerCache();

class BlockUser {
  // -------------------------------------------------------------------------
  // BLOCK USER
  // -------------------------------------------------------------------------
  public block = async (req: Request, res: Response): Promise<void> => {
    const { blockedUserId } = req.params;
    const { userId } = req.currentUser!;

    // 1. Validation
    const { error } = objectIdSchema.validate({ param: blockedUserId });
    if (error) throw new BadRequestError(error.details[0].message);

    if (userId === blockedUserId) {
      throw new BadRequestError('You cannot block yourself');
    }

    // 2. Update Cache
    // This method does 2 things atomically in Redis:
    // a. Adds user to 'users:blocked:userId' Set.
    // b. Removes them from 'followers' and 'following' lists (Cleanup).
    await followerCache.blockUserInCache(userId, blockedUserId);

    // 3. Queue Job (DB Persistence + Notification Cleanup) 💾
    blockedUserQueue.addBlockedUserJob("addBlockToDB", {
      userId,
      blockedUserId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User blocked' });
  };

  // -------------------------------------------------------------------------
  // UNBLOCK USER
  // -------------------------------------------------------------------------
  public unblock = async (req: Request, res: Response): Promise<void> => {
    const { blockedUserId } = req.params;
    const { userId } = req.currentUser!;

    // 1. Validation
    const { error } = objectIdSchema.validate({ param: blockedUserId });
    if (error) throw new BadRequestError(error.details[0].message);

    if (userId === blockedUserId) {
      throw new BadRequestError('You cannot unblock yourself');
    }

    // 2. Update Cache
    // Just removes the ID from the 'users:blocked:userId' Set.
    await followerCache.unblockUserInCache(userId, blockedUserId);

    // 3. Queue Job (DB Persistence)
    // Worker will: Delete Block Document only.
    blockedUserQueue.addBlockedUserJob("removeBlockFromDB", {
      userId,
      blockedUserId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User unblocked' });
  };

  // -------------------------------------------------------------------------
  // GET BLOCKED USERS LIST
  // -------------------------------------------------------------------------
  public getBlockedUsers = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.currentUser!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // 1. Try Cache First
    // Note: slice logic in cache needs start/end index logic
    const start = skip;
    const end = page * limit - 1;

    const cachedList = await followerCache.getBlockedUsersFromCache(userId, start, end);

    // 2. Fallback to DB
    const blockedUsers = cachedList.length
      ? cachedList
      : await blockUserService.getBlockedUsers(userId, skip, limit);

    res.status(HTTP_STATUS.OK).json({
      message: 'Blocked users',
      blockedUsers
    });
  };
}

export const blockUser: BlockUser = new BlockUser();
