import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import HTTP_STATUS from 'http-status-codes';
import { objectIdSchema } from '@global/helpers/joi.schema';
import { BadRequestError } from '@global/helpers/error-handler';
import { followerService } from '@service/db/follower.service';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from '@service/redis/user.cache';
import { userService } from '@service/db/user.service';
import { IFollowerData } from '@follower/interfaces/follower.interface';

const userCache: UserCache = new UserCache();

class Add {
  public follower = async (req: Request, res: Response): Promise<void> => {
    const { followeeId } = req.params;
    const followerId = req.currentUser!.userId;

    // 1. Validation: Validate ObjectId
    const { error } = objectIdSchema.validate({ param: followeeId });
    if (error) throw new BadRequestError(error.details[0].message);

    // 2. Call Service 📞
    const followerDocumentId: ObjectId = new mongoose.Types.ObjectId();
    await followerService.addFollowerToDB(
      followerId, // Follower (Who performs action)
      followeeId, // Followee (Target)
      req.currentUser!.username, // For Notification message
      followerDocumentId.toString()
    );

    const cachedUser: IUserDocument | null = await userCache.getUserFromCache(followeeId);
    let user = cachedUser;

    if (!user) {
      user = await userService.getUserById(followeeId);
      userCache.saveUserToCache(followeeId, user.uId!, user);
    }

    const followerData: IFollowerData = {
      avatarColor: user.avatarColor!,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      profilePicture: user.profilePicture,
      postsCount: user.postsCount,
      username: user.username!,
      uId: user.uId!,
      _id: new ObjectId(followeeId)
    }

    // 3. Response 🚀
    res.status(HTTP_STATUS.OK).json({ follower: followerData, message: 'Following user now' });
  };
}

export const add: Add = new Add();
