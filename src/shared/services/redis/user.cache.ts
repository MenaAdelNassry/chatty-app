import { BaseCache } from '@service/redis/base.cache';
import { INotificationSettings, ISocialLinks, IUserDocument } from '@user/interfaces/user.interface';
import Logger from 'bunyan';
import { config } from '@root/config';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = config.createLogger('userCache');
type UserItem = string | ISocialLinks | INotificationSettings;

export class UserCache extends BaseCache {
  constructor() {
    super('userCache');
  }

  public async saveUserToCache(key: string, uId: string, createdUser: IUserDocument): Promise<void> {
    const createdAt = new Date();

    const dataToSave = {
      _id: `${createdUser._id}`,
      uId: `${createdUser.uId}`,
      username: `${createdUser.username}`,
      email: `${createdUser.email}`,
      avatarColor: `${createdUser.avatarColor}`,
      createdAt: `${createdAt}`,
      postsCount: `${createdUser.postsCount}`,
      blocked: JSON.stringify(createdUser.blocked),
      blockedBy: JSON.stringify(createdUser.blockedBy),
      profilePicture: `${createdUser.profilePicture}`,
      followersCount: `${createdUser.followersCount}`,
      followingCount: `${createdUser.followingCount}`,
      notifications: JSON.stringify(createdUser.notifications),
      social: JSON.stringify(createdUser.social),
      work: `${createdUser.work}`,
      location: `${createdUser.location}`,
      quote: `${createdUser.quote}`,
      school: `${createdUser.school}`,
      bgImageVersion: `${createdUser.bgImageVersion}`,
      bgImageId: `${createdUser.bgImageId}`
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.ZADD('user', { score: parseInt(uId, 10), value: `${key}` });
      const multi = this.client.multi();

      for (const [field, value] of Object.entries(dataToSave)) {
        multi.HSET(`users:${key}`, field, value);
      }
      await multi.exec();
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUserFromCache(userId: string): Promise<IUserDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response = await this.client.HGETALL(`users:${userId}`);
      if (!response || !response._id) {
        return null;
      }

      const user: IUserDocument = this.deserializeUser(response);
      return user;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUsersFromCache(start: number, end: number, excludedUserKey: string): Promise<IUserDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const userIds: string[] = await this.client.ZRANGE('user', start, end + 1, { REV: true });
      const multi = this.client.multi();

      const limit = end - start + 1;
      let numOfUsers = 0;

      userIds.forEach((userId) => {
        if (numOfUsers < limit) {
          if (userId !== excludedUserKey) {
            multi.HGETALL(`users:${userId}`);
            numOfUsers++;
          }
        }
      });

      const replies: any[] = (await multi.exec()) as any[];
      let userReplies: IUserDocument[] = [];

      userReplies = replies.map((reply) => this.deserializeUser(reply));

      return userReplies;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ EDGE CASE (Filtering Depletion)
  //
  // Problem:
  // We fetch a fixed batch (30 users) and filter out those we already follow.
  // If the user follows many people in this random batch, the final result
  // might be less than `USERS_TO_FETCH` (e.g., returning 5 instead of 10).
  //
  // FUTURE FIX:
  // Implement a "Replenishment Loop": Keep fetching random batches until
  // we fill the list to the required size (or hit a max retry limit).
  // -------------------------------------------------------------------------
  public async getRandomUsersFromCache(myId: string): Promise<IUserDocument[]> {
    try {
      if (!this.client.isOpen) await this.client.connect();

      const parsedUsers: IUserDocument[] = [];

      const totalUsersCount = await this.client.ZCARD('user');

      // OPTIMIZATION: Use a Set for O(1) complexity checks instead of O(N) with Arrays.
      // This drastically improves performance when checking against large following lists.
      const userFollowingIds = await this.client.LRANGE(`following:${myId}`, 0, -1);
      const followingSet = new Set(userFollowingIds);

      // OPTIMIZATION: Random Access approach.
      // Instead of fetching ALL users (ZRANGE 0 -1) which kills RAM, we fetch only
      // a small batch of random indices directly from Redis.
      const USERS_TO_FETCH = 10;
      const BATCH_SIZE = 50;

      const randomIds = new Set<string>();

      for (let i = 0; i < BATCH_SIZE; i++) {
        const randomIndex = Math.floor(Math.random() * totalUsersCount);

        const idList = await this.client.ZRANGE('user', randomIndex, randomIndex);
        if (idList.length > 0) randomIds.add(idList[0]);

        if (totalUsersCount < BATCH_SIZE && randomIds.size === totalUsersCount) break;
      }

      const multi = this.client.multi();
      let validCount = 0;

      for (const userId of randomIds) {
        if (userId !== myId && !followingSet.has(userId)) {
          multi.HGETALL(`users:${userId}`);
          validCount++;
          if (validCount === USERS_TO_FETCH) break;
        }
      }

      const usersData = (await multi.exec()) as unknown as Record<string, string>[];

      for (const user of usersData) {
        parsedUsers.push(this.deserializeUser(user));
      }

      return parsedUsers;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updateUserItemsInCache(userId: string, data: { [key: string]: UserItem }): Promise<IUserDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const key = `users:${userId}`;
      const dataToSave: { [key: string]: string } = {};
      const multi = this.client.multi();

      for (const [itemKey, itemValue] of Object.entries(data)) {
        const valueToSave = typeof itemValue === 'string' ? itemValue : JSON.stringify(itemValue);
        multi.HSET(key, itemKey, valueToSave);
      }

      await multi.exec();

      const response: IUserDocument = (await this.getUserFromCache(userId)) as IUserDocument;
      if (!response._id || !response.username) {
        return null;
      }

      return response;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // NOTE For LEARNING 🧠: Redis ZCARD Time Complexity O(1)
  //
  // Why is it O(1) and not O(N)?
  // Redis does NOT iterate through the Sorted Set to count items when ZCARD is called.
  //
  // Internal Mechanism:
  // Redis implements Sorted Sets using a dual data structure:
  // 1. A Hash Table (dict) for mapping members to scores.
  // 2. A Skip List for maintaining order.
  //
  // Crucially, the Skip List structure maintains a `length` property in its header.
  // When we call ZCARD, Redis simply reads this pre-calculated integer from memory.
  // It's an instant memory access operation, regardless of whether the set has
  // 10 users or 10 million users.
  // -------------------------------------------------------------------------
  public async countUsersInCache(): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const totalCount: number = await this.client.ZCARD('user');
      return totalCount;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  private deserializeUser(reply: Record<string, string>): IUserDocument {
    return {
      ...reply, // Spread basic strings (username, email, uId, etc.)
      createdAt: new Date(reply.createdAt),
      postsCount: parseInt(reply.postsCount, 10),
      followersCount: parseInt(reply.followersCount, 10),
      followingCount: parseInt(reply.followingCount, 10),
      blocked: Helpers.parseJson(reply.blocked),
      blockedBy: Helpers.parseJson(reply.blockedBy),
      notifications: Helpers.parseJson(reply.notifications),
      social: Helpers.parseJson(reply.social)
    } as IUserDocument;
  }
}
