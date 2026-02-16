import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { socketIOChatObject } from '@socket/chat';
import { messageReactionSchema } from '@chat/schemes/chat';
import { joiRequestValidationError, NotFoundError } from '@global/helpers/error-handler';
import { ChatCache } from '@service/redis/chat.cache';
import { chatQueue } from '@service/queues/chat.queue';

const chatCache: ChatCache = new ChatCache();

class MessageReaction {
  public async reaction(req: Request, res: Response): Promise<void> {
    const { error } = messageReactionSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    const { conversationId, messageId, reaction, socketId } = req.body;
    const senderId = req.currentUser!.userId;

    // 1. Update Cache (Don't await it to block the socket if you want speed, or await for consistency)
    await chatCache.updateMessageReaction(conversationId, messageId, reaction, senderId);

    // 2. Queue for DB
    chatQueue.addChatJob('updateMessageReactionToDB', { messageId, senderId, reaction });

    // 3. Socket Emission ⚡
    const socketData = { messageId, conversationId, senderId, reaction };

    socketIOChatObject.to(conversationId).except(socketId).emit('message reaction', socketData);

    res.status(HTTP_STATUS.OK).json({ message: 'Reaction updated' });
  }
}

export const messageReaction: MessageReaction = new MessageReaction();
