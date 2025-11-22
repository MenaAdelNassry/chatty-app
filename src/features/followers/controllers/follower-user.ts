// -------------------------------------------------------------------------
// TODO: ⚠️ ATOMICITY & DATA INTEGRITY RISK (Technical Debt)
//
// Problem:
// We are performing two distinct groups of operations:
// 1. Updating counts (HINCRBY).
// 2. Updating lists (LPUSH).
//
// Scenario (The Crash):
// If the server crashes or restarts immediately AFTER step 1 but BEFORE step 2:
// - The 'followersCount' and 'followingCount' will increment (+1).
// - BUT the user ID will NOT be added to the 'followers' or 'following' lists.
//
// Result:
// Data inconsistency. The profile will show "100 Followers" but the list will only display 99 people.
//
// FUTURE TEST & FIX:
// - Simulate a server crash (process.exit) between these lines to prove the bug.
// - Refactor to use a Message Queue (BullMQ) to handle both operations in a single job,
//   or use Redis Transactions (MULTI/EXEC) to wrap all 4 operations together.
// -------------------------------------------------------------------------
import { ObjectId } from 'mongodb';
import { IFollowerData } from '@follower/interfaces/follower.interface';
import { FollowerCache } from '@service/redis/follower.cache';
import { UserCache } from '@service/redis/user.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import HTTP_STATUS from 'http-status-codes';
import { socketIOFollowerObject } from '@socket/follower';
import { followerQueue } from '@service/queues/follower.queue';

const followerCache: FollowerCache = new FollowerCache();
const userCache: UserCache = new UserCache();

class Add {
  public follower = async (req: Request, res: Response): Promise<void> => {
    const { followeeId } = req.params;
    const followerId = req.currentUser!.userId;

    // ----------------- Update Counts in Cache -----------------
    const updateFolloweeCount = followerCache.updateFollowersCountInCache(followeeId, 'followersCount', 1);
    const updateFollowerCount = followerCache.updateFollowersCountInCache(followerId, 'followingCount', 1);
    await Promise.all([updateFolloweeCount, updateFollowerCount]);

    // ----------------- Get User Info -----------------
    const cachedFolloweePromise = userCache.getUserFromCache(followeeId);
    const cachedFollowerPromise = userCache.getUserFromCache(followerId);
    const response = await Promise.all([cachedFolloweePromise, cachedFollowerPromise]);

    // ----------------- Socket IO -----------------
    const addFollowerData: IFollowerData = this.userData(response[1] as IUserDocument);
    socketIOFollowerObject.emit("add follower", addFollowerData);

    // ----------------- Update Lists in Cache -----------------
    const addFolloweeToCache = followerCache.saveFollowerToCache(`following:${followerId}`, followeeId);
    const addFollowerToCache = followerCache.saveFollowerToCache(`followers:${followeeId}`, followerId);
    await Promise.all([addFollowerToCache, addFolloweeToCache]);

    // ----------------- Queue Job -----------------
    const followerObjectId: ObjectId = new ObjectId();
    followerQueue.addFollowerJob("addFollowerToDB", {
      keyOne: followerId,
      keyTwo: followeeId,
      username: req.currentUser!.username,
      followerDocumentId: followerObjectId
    });

    // ----------------- Finally, Response -----------------
    res.status(HTTP_STATUS.OK).json({ message: 'Following user now' });
  };

  private userData = (user: IUserDocument): IFollowerData => {
    return {
      _id: new mongoose.Types.ObjectId(user._id),
      username: user.username!,
      avatarColor: user.avatarColor!,
      postsCount: user.postsCount,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      profilePicture: user.profilePicture,
      uId: user.uId!,
      userProfile: user
    };
  };
}

export const add: Add = new Add();
