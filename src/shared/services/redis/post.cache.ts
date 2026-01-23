import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { IPostDocument, ISavePostToCache } from '@post/interfaces/post.interface';
import { IReactions } from '@reaction/interfaces/reaction.interface';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { FollowerCache } from '@service/redis/follower.cache';

const log: Logger = config.createLogger('postCache');
const followerCache: FollowerCache = new FollowerCache();

export class PostCache extends BaseCache {
  constructor() {
    super('postCache');
  }

  /**
   * @param posts posts we need to save
   * @param currentUserId The user who initiated the transaction (important for the counter)
   * @param isNewPost Is this a new post? (If yes, we'll increase the counter by 1)
   */
  public async savePostsToCache(
    posts: IPostDocument[],
    currentUserId: string,
    isNewPost: boolean = false // Default is false (Cache Repair Mode)
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();

      for (const post of posts) {
        const dataToSave = this.generateDataToSave(post);
        const score = new Date(post.createdAt!).getTime();

        // 1. Global Feed (Only if not private)
        if (post.privacy?.toLowerCase() !== 'private') {
          multi.ZADD('post', { score, value: `${post._id}` });
        }

        // 2. User Feed
        multi.ZADD(`post:${post.userId}`, { score, value: `${post._id}` });

        // 3. Post Data (Hash)
        for (const [key, value] of Object.entries(dataToSave)) {
          multi.HSET(`posts:${post._id}`, key, value);
        }

        // 4. Increment Count (Only for new posts) ✅
        if (isNewPost) {
          multi.HINCRBY(`users:${currentUserId}`, 'postsCount', 1);
        }
      }

      await multi.exec();
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsWithVideosFromCache(key: string, start: number, end: number, userId: string): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const posts: IPostDocument[] = await this.fetchPosts(key, start, end, userId);
      return posts.filter((post) => post.videoId && post.videoVersion);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getPostsFromCache(key: string, start: number, end: number, userId: string): Promise<IPostDocument[]> {
    try {
      return await this.fetchPosts(key, start, end, userId);
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

  public async getPostsWithImagesFromCache(key: string, start: number, end: number, userId: string): Promise<IPostDocument[]> {
    try {
      const posts = await this.fetchPosts(key, start, end, userId);
      return posts.filter((post) => (post.imgId && post.imgVersion) || post.gifUrl);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUserPostsFromCache(
    key: string,
    skip: number,
    limit: number,
    userId: string,
    requestUserId?: string
  ): Promise<IPostDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      if (requestUserId) {
        const isBlockedByOwner = await followerCache.isUserBlockedBy(userId, requestUserId);
        const isOwnerBlocked = await followerCache.isUserBlockedBy(requestUserId, userId);
        if (isBlockedByOwner || isOwnerBlocked) return [];
      }

      const start = skip;
      const end = skip + limit - 1;

      const userPostsIDs: string[] = await this.client.ZRANGE(key, start, end, {
        REV: true
      });

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      for (const postId of userPostsIDs) {
        multi.HGETALL(`posts:${postId}`);
      }

      const postReplies = (await multi.exec()) as IPostDocument[];
      const userPosts: IPostDocument[] = [];

      for (const post of postReplies) {
        if (post && post._id) {
          // ✅ Privacy Filter (Cache)
          if (requestUserId && post.userId !== requestUserId && post.privacy?.toLowerCase() === 'private') {
            continue;
          }

          post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
          post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
          post.createdAt = new Date(`${post.createdAt}`) as Date;
          userPosts.push(post);
        }
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

      const count: number = await this.client.ZCARD(`post:${uId}`);
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
      multi.ZREM(`post:${currentUserId}`, `${postId}`);
      multi.DEL(`posts:${postId}`);
      multi.DEL(`comments:${postId}`);
      multi.DEL(`reactions:${postId}`);

      multi.HINCRBY(`users:${currentUserId}`, 'postsCount', -1);
      await multi.exec();
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async updatePostInCache(postId: string, updatedPost: IPostDocument): Promise<IPostDocument> {
    const { post, bgColor, feelings, privacy, gifUrl, imgVersion, imgId, videoId, videoVersion, createdAt } = updatedPost;
    const multi: ReturnType<typeof this.client.multi> = this.client.multi();

    const dataToSave = {
      post: `${post}`,
      bgColor: `${bgColor}`,
      privacy: `${privacy}`,
      feelings: `${feelings || ''}`,
      gifUrl: `${gifUrl || ''}`,
      imgVersion: `${imgVersion || ''}`,
      imgId: `${imgId || ''}`,
      videoId: `${videoId || ''}`,
      videoVersion: `${videoVersion || ''}`
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // 1. Update Hash Data
      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        multi.HSET(`posts:${postId}`, itemKey, itemValue);
      }

      // 2. 🛡️ Handle Privacy Change
      if (privacy?.toLowerCase() === 'private') {
        multi.ZREM('post', postId);
      } else {
        const postCreatedAt = new Date(`${createdAt}`).getTime();
        multi.ZADD('post', { score: postCreatedAt, value: postId });
      }
      await multi.exec();

      // 3. Return Updated Post
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

  public async getPostFromCache(postId: string, requestUserId: string): Promise<IPostDocument | null> {
    try {
      if (!this.client.isOpen) await this.client.connect();

      const post = (await this.client.HGETALL(`posts:${postId}`)) as unknown as IPostDocument;

      // 1. Safety Check (Empty Object)
      if (!post || Object.keys(post).length === 0) return null;

      // 2. Blocking Check
      const postOwnerId = post.userId;
      let isBlockedByOwner, isOwnerBlocked;

      if (postOwnerId !== requestUserId) {
        isBlockedByOwner = await followerCache.isUserBlockedBy(postOwnerId, requestUserId);
        isOwnerBlocked = await followerCache.isUserBlockedBy(requestUserId, postOwnerId);
      }
      
      if (isBlockedByOwner || isOwnerBlocked) {
        return null;
      }

      // 3. ✅ Privacy Check
      if (post.privacy?.toLowerCase() === 'private' && post.userId !== requestUserId) {
        return null;
      }

      // 4. Parsing
      post.commentsCount = parseInt(`${post.commentsCount}`);
      post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
      post.createdAt = new Date(`${post.createdAt}`) as Date;

      return post;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  private async fetchPosts(key: string, start: number, end: number, requestUserId: string): Promise<IPostDocument[]> {
    if (!this.client.isOpen) await this.client.connect();

    const postIds: string[] = await this.client.ZRANGE(key, start, end, { REV: true });
    const multi = this.client.multi();

    for (const postId of postIds) {
      multi.HGETALL(`posts:${postId}`);
    }

    const rawPosts = (await multi.exec()) as unknown as IPostDocument[];

    // 2. (Async Filtering Pattern)
    const posts: (IPostDocument | null)[] = await Promise.all(
      rawPosts.map(async (post) => {
        // ✅ Safety Check
        if (!post || !post._id || Object.keys(post).length === 0) return null;

        // ✅ Blocking Check
        const isBlockedByOwner = await followerCache.isUserBlockedBy(post.userId, requestUserId);
        const isOwnerBlocked = await followerCache.isUserBlockedBy(requestUserId, post.userId);
        if (isBlockedByOwner || isOwnerBlocked) return null;

        // ✅ Privacy Check
        if (post.privacy?.toLowerCase() === 'private' && post.userId !== requestUserId) {
          return null;
        }

        // ✅ Parsing
        post.commentsCount = Helpers.parseJson(`${post.commentsCount}`) as number;
        post.reactions = Helpers.parseJson(`${post.reactions}`) as IReactions;
        post.createdAt = new Date(`${post.createdAt}`) as Date;

        return post;
      })
    );

    return posts.filter((post): post is IPostDocument => post !== null);
  }

  public async getPostAccessDetails(postId: string): Promise<{ userId: string; privacy: string } | null> {
    try {
      if (!this.client.isOpen) await this.client.connect();

      const result = await this.client.HMGET(`posts:${postId}`, ['userId', 'privacy']);

      if (!result[0] || !result[1]) return null;

      return {
        userId: result[0],
        privacy: result[1]
      };
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  private generateDataToSave(createdPost: IPostDocument) {
    const dataToSave = {
      _id: `${createdPost._id}`,
      userId: `${createdPost.userId}`,
      username: `${createdPost.username}`,
      avatarColor: `${createdPost.avatarColor}`,
      profilePicture: `${createdPost.profilePicture}`,
      post: `${createdPost.post}`,
      email: `${createdPost.email}`,
      bgColor: `${createdPost.bgColor}`,
      feelings: `${createdPost.feelings || ''}`,
      privacy: `${createdPost.privacy}`,
      gifUrl: `${createdPost.gifUrl || ''}`,
      commentsCount: `${createdPost.commentsCount}`,
      reactions: `${JSON.stringify(createdPost.reactions)}`,
      imgVersion: `${createdPost.imgVersion || ''}`,
      imgId: `${createdPost.imgId || ''}`,
      videoVersion: `${createdPost.videoVersion || ''}`,
      videoId: `${createdPost.videoId || ''}`,
      createdAt: `${createdPost.createdAt}`
    };

    return dataToSave;
  }
}
