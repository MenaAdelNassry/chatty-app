import { IFollowerData } from "@follower/interfaces/follower.interface";
import { FollowerCache } from "@service/redis/follower.cache";
import { Request, Response } from "express";
import HTTP_STATUS from 'http-status-codes';
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { followerService } from "@service/db/follower.service";

const followerCache: FollowerCache = new FollowerCache();

class Get {
  public userFollowing = async (req: Request, res: Response): Promise<void> => {
    const userId: ObjectId = new mongoose.Types.ObjectId(req.currentUser!.userId);
    const cachedFollowees: IFollowerData[] = await followerCache.getFollowersFromCache(`following:${userId}`);
    const finalFollowing: IFollowerData[] = cachedFollowees.length
      ? cachedFollowees
      : await followerService.getUserFollowing(userId);

    res.status(HTTP_STATUS.OK).json({ message: 'User following', following: finalFollowing });
  }

  public userFollowers = async (req: Request, res: Response): Promise<void> => {
    const userId: ObjectId = new mongoose.Types.ObjectId(req.currentUser!.userId);
    const cachedFollowers: IFollowerData[] = await followerCache.getFollowersFromCache(`followers:${userId}`);
    const finalFollowers: IFollowerData[] = cachedFollowers.length
      ? cachedFollowers
      : await followerService.getUserFollowers(userId);

    res.status(HTTP_STATUS.OK).json({ message: 'User followers', followers: finalFollowers });
  }
}

export const get: Get = new Get();
