import { config } from '@root/config';
import Logger from 'bunyan';
import { BaseCache } from './base.cache';
import { Helpers } from '@global/helpers/helpers';
import { ServerError } from '@global/helpers/error-handler';
import { ICommentDocument, ICommentNameList } from '@comment/interfaces/comment.interface';

const log: Logger = config.createLogger('commentsCache');

export class CommentCache extends BaseCache {
  constructor() {
    super('commentsCache');
  }

  public async savePostCommentToCache(postId: string, comment: ICommentDocument): Promise<void> {
    // -------------------------------------------------------------------------
    // TODO: ⚠️ FIX RACE CONDITION (Technical Debt)
    // Currently, we are using a "Read-Modify-Write" pattern:
    // 1. Get count (HGET) -> 2. Increment in memory -> 3. Save (HSET).
    // This is NOT atomic. If two users comment at the exact same millisecond, the count will be wrong.
    //
    // REFACTOR PLAN:
    // Replace the lines below with the atomic Redis command:
    // await this.client.HINCRBY(`posts:${postId}`, 'commentsCount', 1);
    // -------------------------------------------------------------------------
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.LPUSH(`comments:${postId}`, JSON.stringify(comment));
      const commentsCountStr = await this.client.HGET(`posts:${postId}`, 'commentsCount');
      let count: number = commentsCountStr ? Helpers.parseJson(commentsCountStr) : 0;

      count += 1;
      await this.client.HSET(`posts:${postId}`, 'commentsCount', `${count}`);
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
      return commentsStr.map((comment) => Helpers.parseJson(comment) as ICommentDocument);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getCommentsNamesFromCache(postId: string): Promise<ICommentNameList> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const commentsStr: string[] = await this.client.LRANGE(`comments:${postId}`, 0, -1);
      const names: string[] = commentsStr.map((comment) => {
        return (Helpers.parseJson(comment) as ICommentDocument).username;
      });

      return {
        count: names.length,
        names
      };
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getSingleCommentFromCache(postId: string, commentId: string): Promise<ICommentDocument | null> {
    // -------------------------------------------------------------------------
    // TODO: ⚠️ PERFORMANCE BOTTLENECK (Technical Debt)
    // We are currently fetching ALL comments (LRANGE 0 -1) just to find ONE by ID.
    //
    // Why this is bad:
    // - O(N) Complexity: If a post has 50,000 comments, Redis sends huge data over the network.
    // - CPU Intensive: The Node.js loop has to parse 50,000 JSON strings to find one ID.
    //
    // FUTURE FIX:
    // - Refactor data structure: Use Redis Hash (HSET comments:postId commentId value).
    // - This would allow O(1) access: HGET comments:postId commentId.
    // -------------------------------------------------------------------------
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const commentsStr: string[] = await this.client.LRANGE(`comments:${postId}`, 0, -1);
      const comments: ICommentDocument[] = commentsStr.map((comment) => Helpers.parseJson(comment) as ICommentDocument);

      const targetComment: ICommentDocument = comments.find((comment) => comment._id === commentId) as ICommentDocument;
      return targetComment;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }
}
