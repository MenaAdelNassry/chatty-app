import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { socketIOChatObject } from '@socket/chat';
import { deleteMessageSchema } from '@chat/schemes/chat';
import { joiRequestValidationError, NotFoundError } from '@global/helpers/error-handler';
import { ChatCache } from '@service/redis/chat.cache';
import { IMessageData } from '@chat/interfaces/message.interface';
import { chatQueue } from '@service/queues/chat.queue';
import { MessageModel } from '@chat/models/message.schema';

const chatCache: ChatCache = new ChatCache();

class Delete {
  public async message(req: Request, res: Response): Promise<void> {
    const { error } = deleteMessageSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    const { messageId, type, conversationId, socketId } = req.body;
    const { userId } = req.currentUser!;

    let updatedMessage: IMessageData | null = null;

    // 1. Try Cache First
    updatedMessage = await chatCache.markMessageAsDeletedInCache(conversationId, messageId, type, userId);

    // 2. Fallback: Cache Miss? Fetch from DB (Read-Only) 🐢
    if (!updatedMessage) {
      const dbMessage = await MessageModel.findById(messageId);
      if(!dbMessage) throw new NotFoundError("Message Not Found");

      updatedMessage = dbMessage as unknown as IMessageData;
    }

    // 3. Add Job to Queue
    chatQueue.addChatJob('markMessageAsDeletedToDB', {
      messageId,
      type,
      senderId: userId
    });

    // 2. Real-time Update (Socket.io) ⚡
    if (type === 'everyone') {
      socketIOChatObject.to(updatedMessage.conversationId.toString()).except(socketId).emit('message deleted', {
        messageId,
        conversationId: updatedMessage.conversationId,
        type: 'everyone'
      });
    } else if (type === 'me') {
      socketIOChatObject.to(userId).except(socketId).emit('message deleted', {
        messageId,
        conversationId: updatedMessage.conversationId,
        type: 'me'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Message deleted',
      updatedMessage
    });
  }
}

export const del: Delete = new Delete();
