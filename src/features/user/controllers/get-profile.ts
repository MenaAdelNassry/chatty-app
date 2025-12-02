import { PostCache } from '@service/redis/post.cache';
import { followerService } from '@service/db/follower.service';
import { FollowerCache } from '@service/redis/follower.cache';
import { IFollowerData } from '@follower/interfaces/follower.interface';
import { userService } from '@service/db/user.service';
import { UserCache } from '@service/redis/user.cache';
import { IAllUsers, IUserDocument } from '@user/interfaces/user.interface';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';
import { BadRequestError } from '@global/helpers/error-handler';
import { IPostDocument } from '@post/interfaces/post.interface';
import { postService } from '@service/db/post.service';

const PAGE_SIZE = 10;

const userCache: UserCache = new UserCache();
const followerCache: FollowerCache = new FollowerCache();
const postCache: PostCache = new PostCache();

interface IUserAll {
  skip: number;
  limit: number;
  start: number;
  end: number;
  excludedUserId: string;
}

class Get {
  // -------------------------------------------------------------------------
  // TODO: ⚠️ SCALABILITY HAZARD (Performance Bottleneck)
  //
  // Current Logic:
  // We fetch ALL followers of the current user to check "Follows You" status for everyone.
  //
  // Problem:
  // If the logged-in user has 100k+ followers (Influencer/Celebrity),
  // this function loads 100k records into memory on EVERY page refresh of "All Users".
  // This will crash the Node.js process (OOM) or timeout the request.
  //
  // FUTURE FIX:
  // Instead of fetching the full list, use a "Check Relationship" query.
  // Send the list of displayed users [ID1, ID2...] to Redis/DB and ask:
  // "Which of these IDs follow me?" -> Return only the matches.
  // -------------------------------------------------------------------------
  public users = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;

    // For DB
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE;
    // For Cache
    const start: number = skip;
    const end: number = skip + limit - 1;

    const userId = req.currentUser!.userId;

    const allUsersData = await this.fetchUsers({ skip, limit, start, end, excludedUserId: userId });
    const followers: IFollowerData[] = await this.fetchUserFollowers(userId);

    res.status(HTTP_STATUS.OK).json({ message: 'Get users', users: allUsersData.users, totalUsers: allUsersData.totalUsers, followers });
  };

  // -------------------------------------------------------------------------
  // TODO: ⚠️ PERFORMANCE OPTIMIZATION (Incomplete Cache-Aside Pattern)
  //
  // Current Logic:
  // If we experience a Cache Miss (user not in Redis), we fetch from MongoDB.
  // However, we return the data immediately WITHOUT saving it back to Redis.
  //
  // The Problem (Read-Through Miss):
  // Subsequent requests for this same user will continue to hit the Database directly
  // until the user manually updates their profile (which triggers a cache write).
  // This defeats the purpose of caching for read-heavy operations.
  //
  // FUTURE FIX:
  // If data is fetched from DB (`!cachedUser`), we must "re-hydrate" the cache:
  // `await userCache.saveUserToCache(userId, existingUser.uId, existingUser);`
  // -------------------------------------------------------------------------
  public userProfileById = async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.userId || req.currentUser!.userId;

    const cachedUser: IUserDocument | null = await userCache.getUserFromCache(userId);
    const existingUser: IUserDocument = cachedUser ? cachedUser : await userService.getUserById(userId);

    if (!existingUser) {
      throw new BadRequestError('User not found');
    }

    res.status(HTTP_STATUS.OK).json({ message: 'Get user profile by id', user: existingUser });
  };

  public userPostsById = async (req: Request, res: Response): Promise<void> => {
    const { userId, page } = req.params;

    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE;

    let targetUId: number | null = null;

    if (userId === req.currentUser!.userId) {
      targetUId = parseInt(req.currentUser!.uId, 10);
    } else {
      const cachedUser = await userCache.getUserFromCache(userId);
      if (cachedUser) {
        targetUId = parseInt(cachedUser.uId!, 10);
      }
    }

    let posts: IPostDocument[] = [];

    if (targetUId) {
      posts = await postCache.getUserPostsFromCache('post', targetUId, skip, limit);
    }

    if (!posts.length) {
      posts = await postService.getPosts({ userId }, skip, limit, { createdAt: -1 });
    }

    res.status(HTTP_STATUS.OK).json({ message: 'Get user posts by id', posts });
  };

  public randomUserSuggestions = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.currentUser!;

    const cachedSuggestedUsers: IUserDocument[] = await userCache.getRandomUsersFromCache(userId);
    let suggestedUsers: IUserDocument[] = cachedSuggestedUsers.length > 0
      ? cachedSuggestedUsers
      : await userService.getRandomUsersFromDB(userId);

    res.status(HTTP_STATUS.OK).json({ message: 'User suggestions', users: suggestedUsers });
  }

  private fetchUsers = async ({ skip, limit, start, end, excludedUserId }: IUserAll): Promise<IAllUsers> => {
    let users: IUserDocument[] = [];
    let type = '';

    const cachedUsers: IUserDocument[] = await userCache.getUsersFromCache(start, end, excludedUserId);
    if (cachedUsers.length > 0) {
      users = cachedUsers;
      type = 'cache';
    } else {
      users = await userService.getAllUsers(excludedUserId, skip, limit);
      type = 'db';
    }

    const totalUsers: number = await this.countTotalUsers(type);
    return { users, totalUsers };
  };

  // -------------------------------------------------------------------------
  // TODO: ⚠️ ARCHITECTURAL RISK (Cache Eviction & Count Accuracy)
  //
  // Problem:
  // If we rely on Redis `ZCARD` to display "Total Registered Users", we risk showing wrong data.
  // Redis is an "In-Memory" store with limited capacity. In production, we usually set
  // Eviction Policies (LRU) or TTL (Time-To-Live) to remove inactive users.
  //
  // The Scenario:
  // 1. We have 1M users in DB.
  // 2. Only 50k active users are currently in Redis Cache.
  // 3. If we return `ZCARD`, the UI shows "Total Users: 50k" (WRONG).
  //
  // FIX:
  // For "Total System Count", ALWAYS fetch from the Source of Truth (MongoDB)
  // using `estimatedDocumentCount()`, or maintain a separate persistent counter key
  // in Redis (e.g., `global:userCount`) that never expires.
  // -------------------------------------------------------------------------
  private countTotalUsers = async (type: string): Promise<number> => {
    const count: number = type === 'cache' ? await userCache.countUsersInCache() : await userService.countUsersInDB();
    return count;
  };

  private fetchUserFollowers = async (userId: string): Promise<IFollowerData[]> => {
    const cachedFollowers: IFollowerData[] = await followerCache.getFollowersFromCache(`followers:${userId}`);
    const result =
      cachedFollowers.length > 0 ? cachedFollowers : await followerService.getUserFollowers(new mongoose.Types.ObjectId(userId));

    return result;
  };
}

export const get: Get = new Get();
