import { IMessageData } from '@chat/interfaces/message.interface';
import { chatQueue } from '@service/queues/chat.queue';
import { MessageCache } from '@service/redis/message.cache';
import { socketIOChatObject } from '@socket/chat';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

const messageCache: MessageCache = new MessageCache();

class Update {
  public markMessageAsRead = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params;
    const lastMessage: IMessageData = await messageCache.markMessagesAsRead(conversationId, req.currentUser!.userId);

    socketIOChatObject.emit('message read', lastMessage);
    socketIOChatObject.emit('chat list', lastMessage);

    chatQueue.addChatJob('markMessageAsReadToDB', {
      conversationId,
      receiverId: req.currentUser!.userId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Message marked as read' });
  };
}

export const update: Update = new Update();
