import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { IReactionDocument, IReactions } from '@reaction/interfaces/reaction.interface';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';

const log: Logger = config.createLogger('reactionCache');

export class ReactionCache extends BaseCache {
  constructor() {
    super('ractionsCache');
  }

  public async savePostReactionToCache(
    key: string,
    reaction: IReactionDocument,
    postReactions: IReactions,
    type: string,
    previousReaction: string
  ): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      if (previousReaction) {
        const isAddingNewReaction: boolean = Boolean(type);
        await this.removePostReactionFromCache(key, reaction.username, postReactions, !isAddingNewReaction);
      }

      if (type) {
        await this.client.LPUSH(`reactions:${key}`, JSON.stringify(reaction));
        await this.client.HSET(`posts:${key}`, 'reactions', JSON.stringify(postReactions));
      }
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  public async removePostReactionFromCache(
    key: string,
    username: string,
    postReactions: IReactions,
    saveToRedis = true
  ): Promise<IReactionDocument> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const multi: ReturnType<typeof this.client.multi> = this.client.multi();
      const listOfReactions: string[] = await this.client.LRANGE(`reactions:${key}`, 0, -1);
      const userPreviousReaction: IReactionDocument = this.getPreviousReaction(listOfReactions, username) as IReactionDocument;

      if (saveToRedis) {
        multi.HSET(`posts:${key}`, 'reactions', JSON.stringify(postReactions));
      }
      multi.LREM(`reactions:${key}`, 1, JSON.stringify(userPreviousReaction));
      await multi.exec();
      return userPreviousReaction;
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

      const postReactions: string[] = await this.client.LRANGE(`reactions:${key}`, 0, -1);
      const parsedPostReactions: IReactionDocument[] = postReactions.map((item) => Helpers.parseJson(item) as IReactionDocument);

      return [parsedPostReactions, postReactions.length];
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  public async getSingleReactionByUsernameFromCache(key: string, username: string): Promise<[IReactionDocument, number] | []> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const postReactions: string[] = await this.client.LRANGE(`reactions:${key}`, 0, -1);
      const result = this.getPreviousReaction(postReactions, username);

      return result ? [result, 1] : [];
    } catch (err) {
      log.error(err);
      throw new ServerError('Server Error. Try again.');
    }
  }

  private getPreviousReaction(listOfReaction: string[], username: string): IReactionDocument | undefined {
    const parsedList: IReactionDocument[] = [];
    for (const reaction of listOfReaction) {
      parsedList.push(Helpers.parseJson(reaction));
    }

    return parsedList.find((reaction) => reaction.username === username);
  }
}
