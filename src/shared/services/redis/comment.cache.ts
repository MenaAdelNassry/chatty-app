import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { ICommentDocument, ICommentNameList } from '@comment/interfaces/comment.interface';

const log: Logger = config.createLogger('commentsCache');

export class CommentCache extends BaseCache {
  constructor() {
    super('commentsCache');
  }

  public async savePostCommentToCache(postId: string, comment: ICommentDocument): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postKey = `posts:${postId}`;
      const commentsKey = `comments:${postId}`;
      const postExists = await this.client.exists(postKey);

      if (postExists) {
        const multi = this.client.multi();

        // 2. Add Comment to List
        multi.lPush(commentsKey, JSON.stringify(comment));

        // 3. Increment Counter atomically
        multi.hIncrBy(postKey, 'commentsCount', 1);

        await multi.exec();
      }
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async saveCommentsToCache(postId: string, comments: ICommentDocument[]): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      if (!comments.length) return;
      const list = comments.map((c) => JSON.stringify(c));
      await this.client.RPUSH(`comments:${postId}`, list);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getCommentsFromCache(postId: string): Promise<ICommentDocument[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const commentsStr: string[] = await this.client.LRANGE(`comments:${postId}`, 0, -1);

      const list: ICommentDocument[] = commentsStr.map((comment) => Helpers.parseJson(comment) as ICommentDocument);

      return list;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getSingleCommentFromCache(postId: string, commentId: string): Promise<ICommentDocument | null> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const commentsStr: string[] = await this.client.LRANGE(`comments:${postId}`, 0, -1);
      for (const item of commentsStr) {
        const comment = Helpers.parseJson(item) as ICommentDocument;

        if (comment._id === commentId) {
          return comment;
        }
      }

      return null;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async deleteCommentFromCache(postId: string, comment: ICommentDocument): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const multi = this.client.multi();

      // 1. Remove specific element from list (Atomic & Safe) 🛡️
      multi.LREM(`comments:${postId}`, 1, JSON.stringify(comment));

      // 2. Decrement Counter
      multi.HINCRBY(`posts:${postId}`, 'commentsCount', -1);

      await multi.exec();
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }
}
