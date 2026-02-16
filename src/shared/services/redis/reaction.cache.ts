import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { IReactionDocument, IReactions } from '@reaction/interfaces/reaction.interface';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { IPostDocument } from '@post/interfaces/post.interface';

const log: Logger = config.createLogger('reactionCache');

export class ReactionCache extends BaseCache {
  constructor() {
    super('reactionCache');
  }

  // New Method: Repair Cache (Hydration) 🔄
  public async saveReactionsToCache(key: string, reactions: IReactionDocument[]): Promise<void> {
    try {
      if (!this.client.isOpen) await this.client.connect();

      for (const reaction of reactions) {
        await this.client.HSET(`reactions:${key}`, `${reaction.userId}`, JSON.stringify(reaction));
      }
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  public async savePostReactionToCache(
    key: string, // postId
    reaction: IReactionDocument,
    type: string,
    previousReaction?: string
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      // 1. Get All Current Reactions Counter (Summary)
      const postInCache = await this.client.HGET(`posts:${key}`, 'reactions');
      const postReactions: IReactions = postInCache
        ? Helpers.parseJson(postInCache)
        : { like: 0, love: 0, happy: 0, wow: 0, sad: 0, angry: 0 };

      // 3. Remove Previous Reaction Logic
      if (previousReaction) {
        this.updateReactionCount(postReactions, previousReaction, -1);
        await this.client.HDEL(`reactions:${key}`, `${reaction.userId}`);
      }

      // 4. Add New Reaction Logic
      if (type) {
        this.updateReactionCount(postReactions, type, 1);
        // HSET: Key=postId, Field=userId, Value=ReactionObject
        await this.client.HSET(`reactions:${key}`, `${reaction.userId}`, JSON.stringify(reaction));
      }

      // 5. Save Counters
      await this.client.HSET(`posts:${key}`, 'reactions', JSON.stringify(postReactions));
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  public async removePostReactionFromCache(key: string, userId: string, post: IPostDocument, previousReaction: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      let postReactions = post.reactions ? { ...post.reactions } : { like: 0, love: 0, happy: 0, wow: 0, sad: 0, angry: 0 };
      this.updateReactionCount(postReactions, previousReaction, -1);

      const multi = this.client.multi();

      multi.HDEL(`reactions:${key}`, userId);
      multi.HSET(`posts:${key}`, 'reactions', JSON.stringify(postReactions));

      await multi.exec();
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  public async getReactionsForPostFromCache(key: string): Promise<[IReactionDocument[], number]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const reactionsCount: number = await this.client.HLEN(`reactions:${key}`);

      const response: string[] = await this.client.HVALS(`reactions:${key}`);

      const list: IReactionDocument[] = [];
      for (const item of response) {
        list.push(Helpers.parseJson(item));
      }

      return [list, reactionsCount];
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  public async getSingleReactionByUserIdFromCache(key: string, userId: string): Promise<[IReactionDocument, number] | []> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response = await this.client.HGET(`reactions:${key}`, userId);

      if (response) {
        return [Helpers.parseJson(response), 1];
      }
      return [];
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  private updateReactionCount(postReactions: IReactions, type: string, value: number): void {
    if (type in postReactions) {
      (postReactions as any)[type] += value;
    }
  }
}
