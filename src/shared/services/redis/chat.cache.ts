import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { config } from '@root/config';
import { NotAuthorizedError, ServerError } from '@global/helpers/error-handler';
import { IMessageData, MessageReactionType } from '@chat/interfaces/message.interface';

const log: Logger = config.createLogger('chatCache');

export class ChatCache extends BaseCache {
  constructor() {
    super('chatCache');
  }

  // 1. Add Message to Cache 💾
  public async addMessageToCache(conversationId: string, message: IMessageData): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const key = `chat:messages:${conversationId}`;
      await this.client.RPUSH(key, JSON.stringify(message));
      await this.client.LTRIM(key, -100, -1);
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  // 2. Get Messages from Cache 📖
  public async getMessagesFromCache(conversationId: string, start: number, end: number, userId: string): Promise<IMessageData[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response: string[] = await this.client.LRANGE(`chat:messages:${conversationId}`, start, end);

      const list: IMessageData[] = [];
      for (const item of response) {
        const parsedItem = JSON.parse(item);
        if(!parsedItem.deletedFor.includes(userId)) list.push(parsedItem);
      }

      return list;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  // 4. Update Reaction
  public async updateMessageReaction(
    conversationId: string,
    messageId: string,
    reaction: MessageReactionType,
    senderId: string
  ): Promise<IMessageData | null> {
    try {
      if (!this.client.isOpen) await this.client.connect();
      const key = `chat:messages:${conversationId}`;

      const messages = await this.client.LRANGE(key, 0, -1);
      const messageIndex = messages.findIndex((msg) => JSON.parse(msg)._id === messageId);

      if (messageIndex > -1) {
        const message: IMessageData = JSON.parse(messages[messageIndex]);
        const existingReaction = message.reaction.find((r) => r.senderId.toString() === senderId);

        if (existingReaction) {
          if (existingReaction.type === reaction) {
            message.reaction = message.reaction.filter((r) => r.senderId.toString() !== senderId);
          } else {
            existingReaction.type = reaction;
          }
        } else {
          message.reaction.push({ senderId, type: reaction });
        }

        await this.client.LSET(key, messageIndex, JSON.stringify(message));
        return message;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error.');
    }
  }

  // 5. Delete Message
  public async markMessageAsDeletedInCache(
    conversationId: string,
    messageId: string,
    type: 'me' | 'everyone',
    senderId: string
  ): Promise<IMessageData | null> {
    try {
      if (!this.client.isOpen) await this.client.connect();
      const key = `chat:messages:${conversationId}`;
      const messages = await this.client.LRANGE(key, 0, -1);

      const index = messages.findIndex((msg) => JSON.parse(msg)._id === messageId);

      if (index > -1) {
        const message: IMessageData = JSON.parse(messages[index]);

        // 1. Delete for Me Logic
        if (type === 'me') {
          message.deletedFor = message.deletedFor || [];
          message.deletedFor.push(senderId);
        }

        // 2. Delete for Everyone Logic
        else if (type === 'everyone') {
          // Basic Ownership Check inside Cache (Optional but good)
          if (message.senderId !== senderId) throw new NotAuthorizedError("You cannot delete this message");

          message.isDeleted = true;
          message.body = 'This message was deleted';
          message.selectedImage = '';
          message.selectedVideo = '';
          message.selectedAudio = '';
          message.gifUrl = '';
          message.replyTo = '';
        }

        // 3. Update in Redis
        await this.client.LSET(key, index, JSON.stringify(message));

        // 4. Return Updated Message
        return message;
      }

      return null;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error.');
    }
  }
}
