import { BaseCache } from '@service/redis/base.cache';
import { INotificationSettings, ISocialLinks, IUserDocument } from '@user/interfaces/user.interface';
import Logger from 'bunyan';
import { config } from '@root/config';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = config.createLogger('userCache');
export type OTPType = 'forgot' | 'signup';
type UserItem = string | ISocialLinks | INotificationSettings | boolean;

export class UserCache extends BaseCache {
  constructor() {
    super('userCache');
  }

  public async saveUserToCache(key: string, uId: string, createdUser: IUserDocument): Promise<void> {
    const dataToSave = this.parseDataForRedis(createdUser);

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

      for (const reply of replies) {
        const user = this.deserializeUser(reply);
        if (!user.freezedAt && user.emailVerified) {
          userReplies.push(user);
        }
      }

      return userReplies;
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

  public async saveOTP(type: OTPType, email: string, otp: string, TTL_IN_SECONDS: number): Promise<void> {
    const key = `${type}_otp:${email}`;

    const data = {
      otp: otp,
      attempts: 0
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.set(key, JSON.stringify(data));

      // ⏳ Expiration
      await this.client.expire(key, TTL_IN_SECONDS);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async verifyOTP(type: OTPType, email: string, userProvidedCode: string): Promise<{ valid: boolean; message: string }> {
    const key = `${type}_otp:${email}`;

    try {
      if (!this.client.isOpen) await this.client.connect();

      const dataString = await this.client.get(key);
      if (!dataString) {
        return { valid: false, message: 'OTP expired or not found' };
      }

      const data = JSON.parse(dataString); // { otp: "123456", attempts: 0 }

      // 1. Check Max Attempts (Prevent Brute Force)
      if (data.attempts >= 3) {
        await this.client.del(key);
        return { valid: false, message: 'Too many failed attempts. Please request a new code.' };
      }

      // 2. Check Code Match
      if (data.otp !== userProvidedCode) {
        data.attempts += 1;
        await this.client.set(key, JSON.stringify(data), { KEEPTTL: true });

        return { valid: false, message: `Invalid Code. ${3 - data.attempts} attempts remaining.` };
      }

      // 3. Success -> Delete OTP
      await this.client.del(key);
      return { valid: true, message: 'Success' };
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async addOnlineUserToCache(userId: string, socketId: string): Promise<string[]> {
    try {
      if (!this.client.isOpen) await this.client.connect();

      // users:sockets:60d5ec... -> { "abc-123", "xyz-789" }
      const key = `users:sockets:${userId}`;
      await this.client.sAdd(key, socketId);

      // Add the user to the general list of online users (in case you want to get them all at once)
      await this.client.sAdd('online-users', userId);

      const sockets = await this.client.sMembers(key);

      return sockets;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getOnlineUsersFromCache(): Promise<string[]> {
    try {
      if (!this.client.isOpen) await this.client.connect();

      const onlineUsers = await this.client.sMembers('online-users');

      return onlineUsers;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async removeOnlineUserFromCache(userId: string, socketId: string): Promise<string[]> {
    try {
      if (!this.client.isOpen) await this.client.connect();
      await this.client.sRem(`users:sockets:${userId}`, socketId);

      const count = await this.client.sCard(`users:sockets:${userId}`);

      if (count === 0) {
        await this.client.sRem('online-users', userId);
        return [];
      } else {
        return await this.client.sMembers(`users:sockets:${userId}`);
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async isUserOnline(userId: string): Promise<boolean> {
    try {
      if (!this.client.isOpen) await this.client.connect();

      return (await this.client.sIsMember('online-users', userId)) === 1;
    } catch (error) {
      log.error(error);
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
      notifications: Helpers.parseJson(reply.notifications),
      social: Helpers.parseJson(reply.social),
      freezedAt: reply.freezedAt ? new Date(reply.freezedAt) : undefined,
      restoredAt: reply.restoredAt ? new Date(reply.restoredAt) : undefined,
      emailVerified: reply.emailVerified === 'true'
    } as IUserDocument;
  }

  private parseDataForRedis(user: IUserDocument): Record<string, string> {
    const data: Record<string, string> = {};
    const userObj = user.toObject ? user.toObject() : user;

    for (const [key, value] of Object.entries(userObj)) {
      if (key === '__v' || key === 'password') continue;

      if (value === null || value === undefined) continue;

      if (value instanceof Date) {
        data[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null && !key.includes('id')) {
        data[key] = JSON.stringify(value);
      } else {
        data[key] = `${value}`;
      }
    }

    return data;
  }
}
