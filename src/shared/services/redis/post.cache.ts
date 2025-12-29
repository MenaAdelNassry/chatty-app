import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { IPostDocument, ISavePostToCache } from '@post/interfaces/post.interface';
import { IReactions } from '@reaction/interfaces/reaction.interface';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = config.createLogger('postCache');

export class PostCache extends BaseCache {
  constructor() {
    super('postCache');
  }

  public async savePostToCache(data: ISavePostToCache): Promise<void> {
    // Note key here is postObjectId
    const { key, currentUserId, uId, createdPost } = data;
    const dataToSave = {
      _id: `${createdPost._id}`,
      userId: `${createdPost.userId}`,
      username: `${createdPost.username}`,
      avatarColor: `${createdPost.avatarColor}`,
      profilePicture: `${createdPost.profilePicture}`,
      post: `${createdPost.post}`,
      email: `${createdPost.email}`,
      bgColor: `${createdPost.bgColor}`,
      feelings: `${createdPost.feelings}`,
      privacy: `${createdPost.privacy}`,
      gifUrl: `${createdPost.gifUrl}`,
      commentsCount: `${createdPost.commentsCount}`,
      reactions: `${JSON.stringify(createdPost.reactions)}`,
      imgVersion: `${createdPost.imgVersion}`,
      imgId: `${createdPost.imgId}`,
      videoVersion: `${createdPost.videoVersion}`,
      videoId: `${createdPost.videoId}`,
      createdAt: `${createdPost.createdAt}`,
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postCount: (string | null)[] = await this.client.HMGET(`users:${currentUserId}`, 'postsCount');
      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      await this.client.ZADD('post', { score: parseInt(uId, 10), value: `${key}` });
      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        multi.HSET(`posts:${key}`, `${itemKey}`, `${itemValue}`);
      }
      const count: number = parseInt(postCount[0] || '0', 10) + 1;
      multi.HSET(`users:${currentUserId}`, 'postsCount', count);
      await multi.exec();
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsWithVideosFromCache(key: string, start: number, end: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const posts: IPostDocument[] = await this.fetchPosts(key, start, end);
      return posts.filter((post) => post.videoId && post.videoVersion);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsFromCache(key: string, start: number, end: number): Promise<IPostDocument[]> {
    try {
      return await this.fetchPosts(key, start, end);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getTotalPostsInCache(): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const count: number = await this.client.ZCARD('post');
      return count;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsWithImagesFromCache(key: string, start: number, end: number): Promise<IPostDocument[]> {
    try {
      const posts = await this.fetchPosts(key, start, end);
      return posts.filter((post) => (post.imgId && post.imgVersion) || post.gifUrl);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUserPostsFromCache(key: string, uId: number, skip: number, limit: number): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const userPostsIDs: string[] = await this.client.ZRANGE(key, String(uId), String(uId), {
        REV: true,
        BY: 'SCORE',
        LIMIT: {
          offset: skip,
          count: limit
        }
      });

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const postId of userPostsIDs) {
        multi.HGETALL(`posts:${postId}`);
      }

      const postReplies = (await multi.exec()) as IPostDocument[];
      const userPosts: IPostDocument[] = [];

      for (const post of postReplies) {
        post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(`${post.createdAt}`) as Date;
        userPosts.push(post);
      }

      return userPosts;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getTotalUserPostsInCache(uId: number): Promise<number> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const count: number = await this.client.ZCOUNT('post', uId, uId);
      return count;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async deletePostFromCache(postId: string, currentUserId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      multi.ZREM('post', `${postId}`);
      multi.DEL(`posts:${postId}`);
      multi.DEL(`comments:${postId}`);
      multi.DEL(`reactions:${postId}`);

      const postCount: (string | null)[] = await this.client.HMGET(`users:${currentUserId}`, 'postsCount');
      const count: number = parseInt(postCount[0]!, 10) - 1;

      multi.HSET(`users:${currentUserId}`, 'postsCount', count);
      await multi.exec();
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updatePostInCache(postId: string, updatedPost: IPostDocument): Promise<IPostDocument> {
    const { post, bgColor, feelings, privacy, gifUrl, imgVersion, imgId, profilePicture, videoId, videoVersion } = updatedPost;
    const multi: ReturnType<typeof this.client.multi> = this.client.multi();

    const dataToSave = {
      post: `${post}`,
      bgColor: `${bgColor}`,
      feelings: `${feelings}`,
      privacy: `${privacy}`,
      gifUrl: `${gifUrl}`,
      imgVersion: `${imgVersion}`,
      imgId: `${imgId}`,
      videoId: `${videoId}`,
      videoVersion: `${videoVersion}`,
      profilePicture: `${profilePicture}`
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        multi.HSET(`posts:${postId}`, itemKey, itemValue);
      }
      await multi.exec();
      const newPostFromCache = await this.client.HGETALL(`posts:${postId}`);

      const newPost: any = newPostFromCache;
      newPost.commentsCount = Helpers.parseJson(`${newPost.commentsCount}`) as number;
      newPost.reactions = Helpers.parseJson(`${newPost.reactions}`) as IReactions;
      newPost.createdAt = new Date(`${newPost.createdAt}`) as Date;

      return newPost as IPostDocument;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  private async fetchPosts(key: string, start: number, end: number): Promise<IPostDocument[]> {
    if (!this.client.isOpen) await this.client.connect();

    const postIds: string[] = await this.client.ZRANGE(key, start, end, { REV: true });
    const multi = this.client.multi();

    for (const postId of postIds) {
      multi.HGETALL(`posts:${postId}`);
    }

    const posts = (await multi.exec()) as unknown as IPostDocument[];
    return posts.map((post) => {
      post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
      post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
      post.createdAt = new Date(`${post.createdAt}`) as Date;
      return post;
    });
  }
}
