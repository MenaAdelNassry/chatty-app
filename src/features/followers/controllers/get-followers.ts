import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';
import { FollowerCache } from '@service/redis/follower.cache';
import { UserCache } from '@service/redis/user.cache';
import { followerService } from '@service/db/follower.service';
import { IFollowerData } from '@follower/interfaces/follower.interface';
import { objectIdSchema } from '@global/helpers/joi.schema';
import { BadRequestError, NotFoundError } from '@global/helpers/error-handler';

const followerCache: FollowerCache = new FollowerCache();
const userCache: UserCache = new UserCache();

class Get {
  // -------------------------------------------------------------------------
  // GET USER FOLLOWING (People I follow)
  // -------------------------------------------------------------------------
  public following = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const { error } = objectIdSchema.validate({ param: userId });
    if (error) throw new BadRequestError(error.details[0].message);


    // Check Blocking
    const isAnyBlocking = await followerService.isAnyBlockingExist(userId, req.currentUser!.userId);
    if(isAnyBlocking) throw new NotFoundError("User Not Found.");

    // 1. Try Cache First
    const start = skip;
    const end = page * limit - 1;

    const cachedFollowing: IFollowerData[] = await followerCache.getFollowersFromCache(`following:${userId}`, start, end);

    // 2. Fallback Logic
    const user = await userCache.getUserFromCache(userId);
    const totalFollowing = user ? user.followingCount : 0;

    let list: IFollowerData[] = cachedFollowing;

    // Fallback
    if (cachedFollowing.length === 0 && totalFollowing > 0) {
      list = await followerService.getUserFollowing(new mongoose.Types.ObjectId(userId), skip, limit);
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'User following',
      following: list,
      totalFollowing
    });
  };

  // -------------------------------------------------------------------------
  // GET USER FOLLOWERS (People following me)
  // -------------------------------------------------------------------------
  public followers = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const { error } = objectIdSchema.validate({ param: userId });
    if (error) throw new BadRequestError(error.details[0].message);

    // Check Blocking
    const isAnyBlocking = await followerService.isAnyBlockingExist(userId, req.currentUser!.userId);
    if(isAnyBlocking) throw new NotFoundError("User Not Found.");

    // 1. Get Total Count FIRST 🔢
    const user = await userCache.getUserFromCache(userId);
    const totalFollowers = user ? user.followersCount : 0;

    // 2. Try Cache ⚡
    const start = skip;
    const end = page * limit - 1;
    const cachedFollowers: IFollowerData[] = await followerCache.getFollowersFromCache(`followers:${userId}`, start, end);

    // 3. Smart DB Fallback 🧠
    let list: IFollowerData[] = cachedFollowers;
    if (cachedFollowers.length === 0 && totalFollowers > 0) {
      list = await followerService.getUserFollowers(new mongoose.Types.ObjectId(userId), skip, limit);
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'User followers',
      followers: list,
      totalFollowers
    });
  };
}

export const get: Get = new Get();
