import { config } from '@root/config';
import Logger from 'bunyan';
import { BaseCache } from '@service/redis/base.cache';
import { ServerError } from '@global/helpers/error-handler';
import { IFollowerData } from '@follower/interfaces/follower.interface';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from './user.cache';
import mongoose from 'mongoose';
import { userService } from '@service/db/user.service';

const log: Logger = config.createLogger('followersCache');

const userCache: UserCache = new UserCache();

export class FollowerCache extends BaseCache {
  constructor() {
    super('followersCache');
  }

  /**
   * ✅ ATOMIC SAVE:
   * 1. Add follower to Sorted Set (ZADD) - Handles duplicates & ordering automatically.
   * 2. Increment count (HINCRBY) - Updates user profile count.
   * Both happen together or fail together.
   */
  public async saveFollowerToCache(
    key: string,
    value: string,
    userId: string,
    countProp: 'followingCount' | 'followersCount'
  ): Promise<void> {
    // this will be used for follower and follwee ==> (following:USER_ID) and (followers:USER_ID)
    try {
      await this.checkConnection();

      const multi = this.client.multi(); // 🟢 Start Transaction

      // 1. Add to Sorted Set (Score = Timestamp for chronological order)
      // This solves the 'Duplicate' issue (Idempotency) because ZADD is unique by value.
      multi.zAdd(key, { score: Date.now(), value });

      // 2. Increment the count atomically
      multi.hIncrBy(`users:${userId}`, countProp, 1);

      await multi.exec(); // 🚀 Execute all
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  /**
   * ✅ ATOMIC REMOVE:
   * 1. Remove from Sorted Set (ZREM).
   * 2. Decrement count (HINCRBY -1).
   */
  /**
   * key: The Redis Key for the set (e.g., 'followers:123' or 'following:123')
   * value: The ID to remove from the set
   * userId: The ID of the user to decrement the count for
   * countProp: 'followersCount' or 'followingCount'
   */
  public async removeFollowerFromCache(key: string, value: string, userId: string, countProp: string): Promise<void> {
    try {
      await this.checkConnection();

      const multi = this.client.multi();

      // 1. Remove from Sorted Set (Use the full KEY, not just userId)
      multi.zRem(key, value);

      // 2. Decrement the count atomically (Use the userId to find the User Hash)
      multi.hIncrBy(`users:${userId}`, countProp, -1);

      await multi.exec();
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  /**
   * ✅ PAGINATION IMPLEMENTED:
   */
  public async getFollowersFromCache(key: string, start: number, end: number, loggedUserId: string): Promise<IFollowerData[]> {
    try {
      if (!this.client.isOpen) {
        this.client.connect();
      }

      // ZRANGE with 'REV' returns newest first (highest score/timestamp to lowest)
      // start: 0, end: 10 gives the top 11 items.
      const followersIds: string[] = await this.client.zRange(key, start, end, { REV: true });

      // If list is empty, return early to save resources
      if (!followersIds.length) {
        return [];
      }

      const isMyFollowingList = key === `following:${loggedUserId}`;

      const followersPromises = followersIds.map(async (id) => {
        let user: IUserDocument | null = await userCache.getUserFromCache(id);

        // 🛡️ Null Safety: In case user is evicted from cache
        if (!user) {
          user = await userService.getUserById(id);
        }
        if (!user) return null;

        let isFollowing = false;
        if (isMyFollowingList) {
          // If it's my list, I am definitely following them.
          isFollowing = true;
        } else {
          // Otherwise, we must check Redis to see if I follow this specific user.
          // We check if 'loggedUserId' exists in the 'followers' list of 'id'.
          isFollowing = await this.isUserFollowing(loggedUserId, id);
        }

        const data: IFollowerData = {
          avatarColor: user.avatarColor!,
          followersCount: user.followersCount!,
          followingCount: user.followingCount!,
          profilePicture: user.profilePicture!,
          postsCount: user.postsCount!,
          username: user.username!,
          bgImageId: user.bgImageId,
          bgImageVersion: user.bgImageVersion,
          uId: user.uId!,
          isFollowing,
          _id: new mongoose.Types.ObjectId(user._id),
        };

        return data;
      });

      // Filter out any nulls (in case a user wasn't found in cache)
      const followers: IFollowerData[] = (await Promise.all(followersPromises)).filter((f) => f !== null);
      return followers;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // ✅ BLOCK USER:
  // Uses Redis SET (SADD).
  // - Unique: Prevents duplicates automatically (Idempotency).
  // - Fast: O(1) operation.
  // -------------------------------------------------------------------------
  public async blockUserInCache(userId: string, blockedUserId: string): Promise<void> {
    try {
      await this.checkConnection();

      // 1. Add to Blocked Set
      await this.client.sAdd(`users:blocked:${userId}`, blockedUserId);

      // 2. Remove "He" from "My Following"
      // zRem returns number of elements removed (1 if removed, 0 if not found)
      const removedFromFollowing = await this.client.zRem(`following:${userId}`, blockedUserId);
      const removedFromFollowers = await this.client.zRem(`followers:${blockedUserId}`, userId);

      if (removedFromFollowing || removedFromFollowers) {
        await this.client.hIncrBy(`users:${userId}`, 'followingCount', -1);
        await this.client.hIncrBy(`users:${blockedUserId}`, 'followersCount', -1);
      }

      // 3. Remove "Me" from "His Following"
      const removedFromHisFollowing = await this.client.zRem(`following:${blockedUserId}`, userId);
      const removedFromMyFollowers = await this.client.zRem(`followers:${userId}`, blockedUserId);

      if (removedFromHisFollowing || removedFromMyFollowers) {
        await this.client.hIncrBy(`users:${blockedUserId}`, 'followingCount', -1);
        await this.client.hIncrBy(`users:${userId}`, 'followersCount', -1);
      }
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async unblockUserInCache(userId: string, blockedUserId: string): Promise<void> {
    try {
      await this.checkConnection();

      const key = `users:blocked:${userId}`;
      await this.client.sRem(key, blockedUserId);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // 🛠️ HELPER: CHECK IF BLOCKED
  // Useful helper to quickly check if User A blocked User B
  // Uses SISMEMBER (O(1)) - Extremely fast check.
  // -------------------------------------------------------------------------
  public async isUserBlockedBy(userId: string, possibleBlockerId: string): Promise<boolean> {
    try {
      await this.checkConnection();

      const key = `users:blocked:${possibleBlockerId}`;
      return (await this.client.SISMEMBER(key, userId)) === 1;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getBlockedUsersFromCache(userId: string, start: number, end: number): Promise<{ blockedUsers: IFollowerData[]; total: number }> {
    try {
      await this.checkConnection();

      const key = `users:blocked:${userId}`;
      // 1. Get ALL blocked IDs (SMEMBERS returns an unsorted array)
      const response: string[] = await this.client.sMembers(key);

      const total = response.length;

      // If empty, return consistent structure
      if (!total) {
        return { blockedUsers: [], total: 0 };
      }

      // 2. Manual Sort (Crucial for consistent pagination)
      // We sort alphabetically by ID to ensure the order doesn't change on refresh.
      response.sort();

      // 3. Manual Slice (Pagination Logic)
      const pagedIds = response.slice(start, end + 1);

      // 4. Hydrate User Data
      const followersPromises = pagedIds.map(async (id) => {
        let user: IUserDocument | null = await userCache.getUserFromCache(id);
        if(!user) {
          user = await userService.getUserById(id);
        }
        if (!user) return null;

        return {
          _id: new mongoose.Types.ObjectId(user._id),
          username: user.username!,
          avatarColor: user.avatarColor!,
          uId: user.uId!,
          postsCount: user.postsCount,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          profilePicture: user.profilePicture
        } as IFollowerData;
      });

      const blockedUsers: IFollowerData[] = (await Promise.all(followersPromises)).filter((user) => user !== null) as IFollowerData[];
      return { blockedUsers, total };
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getFolloweesFromCache(key: string): Promise<string[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const response = await this.client.ZRANGE(key, 0, -1);
      return response;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async isUserFollowing(userId: string, followeeId: string): Promise<boolean> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const key = `followers:${followeeId}`;

      const score = await this.client.zScore(key, userId);

      return score !== null;

    } catch (error) {
      log.error(error);
      return false; // Fail-safe
    }
  }

  // -------------------------------------------------------------------------
  // 🛡️ INTERNAL HELPER: CHECK CONNECTION
  // -------------------------------------------------------------------------
  private async checkConnection(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }
}
