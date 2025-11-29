import { IConversationDocument } from '@chat/interfaces/conversation.interface';
import { IMessageData, TReactionMessage } from '@chat/interfaces/message.interface';
import { ConversationModel } from '@chat/models/conversation.schema';
import { MessageModel } from '@chat/models/message.schema';
import mongoose from 'mongoose';
import { TDeletedMessage } from '@chat/interfaces/message.interface';

class ChatService {
  public async addMessageToDB(data: IMessageData): Promise<void> {
    const { conversationId, senderId, receiverId } = data;
    await ConversationModel.updateOne(
      { _id: conversationId },
      {
        $setOnInsert: {
          senderId,
          receiverId
        }
      },
      { upsert: true }
    );

    await MessageModel.create({
      ...data
    });
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ DATA INTEGRITY & SORTING ISSUE (Technical Debt)
  //
  // Current Implementation Risk:
  // We are using `$group` with `$last` to fetch the most recent message.
  // However, MongoDB does NOT guarantee the order of documents entering the `$group` stage
  // unless they are explicitly sorted beforehand.
  //
  // The Problem (Natural Order):
  // Without an initial `$sort`, MongoDB reads data in "Natural Order" (disk storage order).
  // If a document was updated/moved on disk, an older message might appear "last" in the stream.
  // This would cause the inbox to show an outdated message instead of the real latest one.
  //
  // FUTURE ACTION PLAN:
  // 1. Study MongoDB Internal Storage (WiredTiger) and how "Natural Order" works.
  // 2. Reproduce the bug by creating a scenario where physical storage order != logical order.
  // 3. FIX: Add `{ $sort: { createdAt: 1 } }` as the FIRST stage in the pipeline.
  // -------------------------------------------------------------------------
  public async getUserConversationList(userId: string): Promise<IMessageData[]> {
    const messages: IMessageData[] = await MessageModel.aggregate([
      { $match: { $or: [{ senderId: new mongoose.Types.ObjectId(userId) }, { receiverId: new mongoose.Types.ObjectId(userId) }] } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$conversionId',
          result: { $last: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$result' } },
      { $sort: { createdAt: -1 } }
    ]);

    return messages;
  }

  public async getMessages(conversationId: string, sort: Record<string, 1 | -1>): Promise<IMessageData[]> {
    const messages: IMessageData[] = await MessageModel.aggregate([
      { $match: { conversationId: new mongoose.Types.ObjectId(conversationId) } },
      { $sort: sort }
    ]);

    return messages;
  }

  public async getConversationId(senderId: string, receiverId: string): Promise<IConversationDocument | null> {
    const conversation = await ConversationModel.findOne({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    });

    return conversation;
  }

  public async markMessageAsDeleted(messageId: string, type: TDeletedMessage): Promise<void> {
    if (type === 'deleteForMe') {
      await MessageModel.updateOne({ _id: messageId }, { $set: { deleteForMe: true } });
    } else {
      await MessageModel.updateOne({ _id: messageId }, { $set: { deleteForMe: true, deleteForEveryone: true } });
    }
  }

  public async markMessageAsRead(conversationId: string, receiverId: string): Promise<void> {
    await MessageModel.updateMany(
      { conversationId, isRead: false, receiverId: new mongoose.Types.ObjectId(receiverId) },
      { $set: { isRead: true } }
    );
  }

  public async updateMessageReaction(messageId: string, senderName: string, reaction: string, type: TReactionMessage): Promise<void> {
    await MessageModel.updateOne({ _id: new mongoose.Types.ObjectId(messageId) }, { $pull: { reaction: { senderName } } });

    if (type === 'add') {
      await MessageModel.updateOne({ _id: new mongoose.Types.ObjectId(messageId) }, { $push: { reaction: { senderName, type: reaction } } });
    }
  }
}

export const chatService: ChatService = new ChatService();
