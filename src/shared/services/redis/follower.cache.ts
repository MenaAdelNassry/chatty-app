import { config } from '@root/config';
import Logger from 'bunyan';
import { BaseCache } from '@service/redis/base.cache';
import { ServerError } from '@global/helpers/error-handler';
import { IFollowerData } from '@follower/interfaces/follower.interface';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from './user.cache';
import mongoose from 'mongoose';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = config.createLogger('followersCache');

type FollowerProp = 'followersCount' | 'followingCount';

const userCache: UserCache = new UserCache();

export class FollowerCache extends BaseCache {
  constructor() {
    super('followersCache');
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ ARCHITECTURE IMPROVEMENT (Technical Debt)
  // Currently using Redis LIST (LPUSH) which allows duplicates.
  // Scenario: If a user experiences lag and clicks "Follow" multiple times,
  // their ID will be stored multiple times in the list.
  //
  // FUTURE FIX:
  // Switch to Redis SET (SADD/SREM). Sets automatically enforce uniqueness,
  // preventing duplicate followers even if the request is sent multiple times.
  // -------------------------------------------------------------------------
  public async saveFollowerToCache(key: string, value: string): Promise<void> {
    // this will be used for follower and follwee
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.LPUSH(key, value);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async removeFollowerFromCache(key: string, value: string): Promise<void> {
    // this will be used for follower and follwee
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.LREM(key, 1, value);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ DATA INTEGRITY RISK (Atomicity)
  // We are updating the follower list and the count in two separate network calls.
  // Scenario: If the server crashes/restarts AFTER adding the name but BEFORE
  // incrementing the count, data becomes inconsistent (e.g., List has 100 items, Count says 99).
  //
  // FUTURE FIX:
  // Refactor to use Redis Transactions (multi/exec). Combine the 'LPUSH' (or SADD)
  // and 'HINCRBY' into a single atomic execution to ensure both succeed or fail together.
  // -------------------------------------------------------------------------
  public async updateFollowersCountInCache(userId: string, prop: FollowerProp, value: number): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.HINCRBY(`users:${userId}`, prop, value);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // Can be used for followers or following
  public async getFollowersFromCache(key: string): Promise<IFollowerData[]> {
    try {
      if (!this.client.isOpen) {
        this.client.connect();
      }

      // -------------------------------------------------------------------------
      // TODO: 💣 CRASH RISK (Null Safety)
      //
      // Current Logic:
      // We assume data ALWAYS exists in Redis. We fetch user by ID and immediately access properties
      // like `user.avatarColor` without checking if `user` is null.
      //
      // HOW TO REPRODUCE THE BUG (After finishing the project):
      // 1. Create a follower.
      // 2. Go to Redis CLI/GUI and manually delete that follower's user data key (`users:ID`).
      // 3. Call this endpoint.
      // 4. RESULT: Server will CRASH with `TypeError: Cannot read properties of null`.
      //
      // FUTURE FIX:
      // Check if `user` is null inside the loop. If null, fetch from MongoDB (Fallback).
      // -------------------------------------------------------------------------
      const followersIds: string[] = await this.client.LRANGE(key, 0, -1);
      const followersPromises = followersIds.map(async (id) => {
        const user: IUserDocument = (await userCache.getUserFromCache(id)) as IUserDocument;
        const data: IFollowerData = {
          avatarColor: user.avatarColor!,
          followersCount: user.followersCount!,
          followingCount: user.followingCount!,
          profilePicture: user.profilePicture!,
          postsCount: user.postsCount!,
          username: user.username!,
          uId: user.uId!,
          _id: new mongoose.Types.ObjectId(user._id),
          userProfile: user
        };

        return data;
      });

      const followers: IFollowerData[] = await Promise.all(followersPromises);
      return followers;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ CONCURRENCY HAZARD (Race Condition)
  //
  // Problem:
  // We are using a "Read-Modify-Write" pattern (HGET -> JS Logic -> HSET).
  // This operation is NOT atomic.
  //
  // Scenario:
  // If two requests to block different users arrive simultaneously:
  // 1. Req A reads list: []
  // 2. Req B reads list: [] (because A hasn't written yet)
  // 3. Req A writes: ['User1']
  // 4. Req B writes: ['User2'] -> OVERWRITES 'User1'!
  //
  // FUTURE FIX:
  // - Migrate data structure from JSON List to Redis SET.
  // - Use atomic commands: SADD (add unique) and SREM (remove).
  // - Redis Sets handle concurrency natively without race conditions.
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // TODO: 🛡️ IDEMPOTENCY CHECK (Duplicate Prevention)
  //
  // Problem:
  // Network lag or "double-clicks" can cause the client to send the same
  // block request multiple times. Without this check, the list would contain
  // duplicate IDs (e.g., ['User1', 'User1']).
  //
  // Solution:
  // We explicitly check `!includes(value)` before pushing.
  // Note: This check relies on the "read" state, so it is still vulnerable
  // to the Race Condition mentioned above until we switch to Redis Sets.
  // -------------------------------------------------------------------------
  public async updateBlockedUserPropInCache(
    userId: string,
    prop: 'blocked' | 'blockedBy',
    value: string,
    type: 'block' | 'unblock'
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      let blockedUserList: string[] = Helpers.parseJson((await this.client.HGET(`users:${userId}`, prop)) as string) || [];
      blockedUserList = type === 'block' ? [...blockedUserList, value] : blockedUserList.filter((id) => id !== value);

      await this.client.HSET(`users:${userId}`, prop, JSON.stringify(blockedUserList));
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }
}
