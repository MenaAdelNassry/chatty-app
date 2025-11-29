import { IChatList, IChatUsers, IMessageData, TReactionMessage } from '@chat/interfaces/message.interface';
import { ServerError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { config } from '@root/config';
import { BaseCache } from '@service/redis/base.cache';
import Logger from 'bunyan';
import { TDeletedMessage } from '@chat/interfaces/message.interface';

const log: Logger = config.createLogger('messageCache');

export class MessageCache extends BaseCache {
  constructor() {
    super('messageCache');
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ PERFORMANCE & LOGIC BOTTLENECK (Technical Debt)
  //
  // 1. Performance O(N):
  //    We are fetching the ENTIRE list (LRANGE) and looping through it (findIndex)
  //    just to check existence. As the chat list grows, this becomes very slow.
  //
  // 2. Static Ordering (No "Bump to Top"):
  //    Currently, if a user already exists in the list, we do NOTHING.
  //    In real chat apps, sending a new message should move the conversation
  //    to the TOP of the list (Most Recent).
  //
  // FUTURE FIX:
  // - Switch to Redis Sorted Sets (ZADD).
  // - Use `timestamp` as the score.
  // - ZADD automatically handles "Update if exists" and sorts by time.
  // - Complexity becomes O(log(N)) which is much faster and logically correct.
  // -------------------------------------------------------------------------
  public async addChatListToCache(senderId: string, receiverId: string, conversationId: string): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const userChatList = await this.client.LRANGE(`chatList:${senderId}`, 0, -1);
      const receiverIndex: number = userChatList.findIndex((listItem: string) => {
        const parsedItem = Helpers.parseJson(listItem);
        return parsedItem.receiverId === receiverId;
      });

      if (receiverIndex < 0) {
        await this.client.RPUSH(`chatList:${senderId}`, JSON.stringify({ receiverId, conversationId }));
      }
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ MEMORY LEAK RISK (Infinite List Growth)
  //
  // Current Logic:
  // We use `RPUSH` to append every new message to the Redis List.
  // There is no limit on the list size.
  //
  // Problem:
  // If two users chat for years (e.g., 50,000 messages), this list will consume
  // a huge amount of Redis RAM (which is expensive). Loading this list will also become slow.
  //
  // FUTURE FIX (Cache Eviction):
  // Keep only the latest 100-500 messages in Redis for quick access.
  // Use `LTRIM` after pushing to truncate the list.
  // Example: await this.client.LTRIM(`messages:${conversationId}`, -100, -1);
  // Older messages should be fetched from MongoDB (Pagination).
  // -------------------------------------------------------------------------
  public async addChatMessageToCache(conversationId: string, value: IMessageData): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      await this.client.RPUSH(`messages:${conversationId}`, JSON.stringify(value));
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async addChatUsersToCache(value: IChatUsers): Promise<IChatUsers[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const chatUsers: IChatUsers[] = await this.getChatUsersList();
      const chatUserIndex: number = chatUsers.findIndex(
        (chat) =>
          (chat.userOne === value.userOne && chat.userTwo === value.userTwo) ||
          (chat.userOne === value.userTwo && chat.userTwo === value.userOne)
      );

      if (chatUserIndex === -1) {
        await this.client.RPUSH('chatUsers', JSON.stringify(value));
        chatUsers.push(value);
      }

      return chatUsers;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async removeChatUsersFromCache(value: IChatUsers): Promise<IChatUsers[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const chatUsers: IChatUsers[] = await this.getChatUsersList();
      const chatUserIndex: number = chatUsers.findIndex(
        (chat) =>
          (chat.userOne === value.userOne && chat.userTwo === value.userTwo) ||
          (chat.userOne === value.userTwo && chat.userTwo === value.userOne)
      );

      if (chatUserIndex !== -1) {
        await this.client.LREM('chatUsers', 1, JSON.stringify(value));
        chatUsers.splice(chatUserIndex, 1);
      }

      return chatUsers;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUserConversationList(userId: string): Promise<IMessageData[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const userChatList: string[] = await this.client.LRANGE(`chatList:${userId}`, 0, -1);

      const conversationChatListPromises = userChatList.map(async (chatUser) => {
        const parsedChat: IChatList = Helpers.parseJson(chatUser);
        const message: string = (await this.client.LINDEX(`messages:${parsedChat.conversationId}`, -1)) as string;
        return Helpers.parseJson(message) as IMessageData;
      });

      const conversationChatList: IMessageData[] = await Promise.all(conversationChatListPromises);
      return conversationChatList;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getChatMessagesFromCache(conversationId: string): Promise<IMessageData[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const messages: string[] = await this.client.LRANGE(`messages:${conversationId}`, 0, -1);
      return messages.map((message) => Helpers.parseJson(message)) as IMessageData[];
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ INBOX SYNC ISSUE (Data Consistency)
  // If the deleted message was the LAST message in the conversation:
  // The `chatList` (Inbox) might still show the OLD preview text if it caches snippets.
  // FIX: Check if `messageIndex` is the last index, and if so, update the `chatList` metadata
  // for both users to reflect "This message was deleted".
  // -------------------------------------------------------------------------
  public async markMessageAsDeleted(conversationId: string, messageId: string, type: TDeletedMessage): Promise<IMessageData> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const messages: string[] = await this.client.LRANGE(`messages:${conversationId}`, 0, -1);
      const messageIndex: number = messages.findIndex((msg) => {
        const parsedMsg: IMessageData = Helpers.parseJson(msg);
        return parsedMsg._id === messageId;
      });

      if (messageIndex === -1) throw new ServerError('Message not found');

      const messageToUpdate = Helpers.parseJson(messages[messageIndex]) as IMessageData;
      if (type === 'deleteForMe') {
        messageToUpdate.deleteForMe = true;
      } else {
        messageToUpdate.deleteForMe = true;
        messageToUpdate.deleteForEveryone = true;
      }

      await this.client.LSET(`messages:${conversationId}`, messageIndex, JSON.stringify(messageToUpdate));

      return messageToUpdate;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async markMessagesAsRead(conversationId: string, myId: string): Promise<IMessageData> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const messagesStr: string[] = await this.client.LRANGE(`messages:${conversationId}`, 0, -1);
      const messages: IMessageData[] = messagesStr.map((msg) => Helpers.parseJson(msg));

      const multi = this.client.multi();

      messages.forEach((msg, index) => {
        if (!msg.isRead && msg.receiverId === myId) {
          msg.isRead = true;
          multi.LSET(`messages:${conversationId}`, index, JSON.stringify(msg));
        }
      });

      await multi.exec();

      const lastMessage = messages[messages.length - 1];
      return lastMessage;
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ RACE CONDITION RISK (Read-Modify-Write)
  //
  // Problem:
  // We are reading the full message payload, modifying the reaction array in Node.js memory,
  // and writing it back. This is NOT atomic.
  //
  // Scenario:
  // If User A and User B react to the same message simultaneously:
  // 1. Both read the initial state.
  // 2. User A writes [..., A].
  // 3. User B writes [..., B] -> Overwriting User A's reaction!
  //
  // FUTURE FIX:
  // Use Redis Lua Scripting to perform the parse-modify-write logic atomically inside Redis,
  // or switch to RedisJSON module for atomic array operations.
  // -------------------------------------------------------------------------
  public async updateMessageReaction(
    messageId: string,
    conversationId: string,
    type: TReactionMessage,
    senderName: string,
    reaction: string
  ): Promise<IMessageData> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const messagesStr: string[] = await this.client.LRANGE(`messages:${conversationId}`, 0, -1);
      const messages: IMessageData[] = messagesStr.map((msg) => Helpers.parseJson(msg));

      const msgIndex: number = messages.findIndex((msg) => msg._id === messageId);
      if (msgIndex === -1) {
        throw new ServerError('Message is not found.');
      }
      const updatedReactionsMessage = messages[msgIndex].reaction.filter((reaction) => reaction.senderName !== senderName);

      if (type === 'add') {
        updatedReactionsMessage.push({ senderName, type: reaction });
      }

      messages[msgIndex].reaction = updatedReactionsMessage;
      await this.client.LSET(`messages:${conversationId}`, msgIndex, JSON.stringify(messages[msgIndex]));

      return messages[msgIndex];
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }

  private async getChatUsersList(): Promise<IChatUsers[]> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const chatUsers = await this.client.LRANGE('chatUsers', 0, -1);
      return chatUsers.map((chat) => Helpers.parseJson(chat) as IChatUsers);
    } catch (err) {
      log.error(err);
      throw new ServerError('Server error. Try again.');
    }
  }
}
