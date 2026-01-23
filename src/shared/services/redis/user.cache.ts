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
    const dataToSave = {
      _id: `${createdUser._id}`,
      uId: `${createdUser.uId}`,
      username: `${createdUser.username}`,
      email: `${createdUser.email}`,
      avatarColor: `${createdUser.avatarColor}`,
      createdAt: `${createdUser.createdAt}` || `${Date.now()}`,
      postsCount: `${createdUser.postsCount}`,
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

  private deserializeUser(reply: Record<string, string>): IUserDocument {
    return {
      ...reply, // Spread basic strings (username, email, uId, etc.)
      createdAt: new Date(reply.createdAt),
      postsCount: parseInt(reply.postsCount, 10),
      followersCount: parseInt(reply.followersCount, 10),
      followingCount: parseInt(reply.followingCount, 10),
      notifications: Helpers.parseJson(reply.notifications),
      social: Helpers.parseJson(reply.social)
    } as IUserDocument;
  }
}
