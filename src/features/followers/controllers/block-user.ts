import { blockedUserQueue } from "@service/queues/blocked.queue";
import { FollowerCache } from "@service/redis/follower.cache";
import { Request, Response } from "express";
import HTTP_STATUS from 'http-status-codes';

const followerCache: FollowerCache = new FollowerCache();

class BlockUser {
  public block = async (req: Request, res: Response): Promise<void> => {
    const { blockedUserId } = req.params;
    const { userId } = req.currentUser!;

    await this.updateBlockedUser(userId, blockedUserId, 'block');
    blockedUserQueue.addBlockedUserJob("updateBlockedUserInDB", {
      keyOne: userId, keyTwo: blockedUserId, type: 'block'
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User blocked' });
  }

  public unblock = async (req: Request, res: Response): Promise<void> => {
    const { blockedUserId } = req.params;
    const { userId } = req.currentUser!;

    await this.updateBlockedUser(userId, blockedUserId, 'unblock');
    blockedUserQueue.addBlockedUserJob("updateBlockedUserInDB", {
      keyOne: userId, keyTwo: blockedUserId, type: 'unblock'
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User unblocked' });
  }

  private updateBlockedUser = async (userId: string, blockedUserId: string, type: 'block' | 'unblock'): Promise<void> => {
    const blocked = followerCache.updateBlockedUserPropInCache(userId, 'blocked', blockedUserId, type);
    const blockedBy = followerCache.updateBlockedUserPropInCache(blockedUserId, 'blockedBy', userId, type);

    await Promise.all([blocked, blockedBy]);
  }
}

export const blockUser: BlockUser = new BlockUser();
