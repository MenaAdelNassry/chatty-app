import { followerQueue } from "@service/queues/follower.queue";
import { FollowerCache } from "@service/redis/follower.cache";
import { Request, Response } from "express";
import HTTP_STATUS from 'http-status-codes';

const followerCache: FollowerCache = new FollowerCache();

class Remove {
  public async follower(req: Request, res: Response): Promise<void> {
    const { followeeId } = req.params;
    const followerId = req.currentUser!.userId;

    // -------------------------------------------------------------------------
    // TODO: ⚠️ ATOMICITY RISK (Technical Debt)
    // We are performing 4 separate Redis operations in parallel.
    // If server crashes mid-process, we might end up with inconsistent state
    // (e.g., removed from list but count didn't decrement).
    // FUTURE FIX: Use Redis Transactions (MULTI/EXEC).
    // -------------------------------------------------------------------------
    await Promise.all([
      followerCache.removeFollowerFromCache(`followers:${followeeId}`, followerId),
      followerCache.removeFollowerFromCache(`following:${followerId}`, followeeId),
      followerCache.updateFollowersCountInCache(followeeId, "followersCount", -1),
      followerCache.updateFollowersCountInCache(followerId, "followingCount", -1)
    ]);

    followerQueue.addFollowerJob('removeFollowerFromDB', {
      keyOne: followeeId,
      keyTwo: followerId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Unfollowed user now' });
  }
}

export const remove: Remove = new Remove();
