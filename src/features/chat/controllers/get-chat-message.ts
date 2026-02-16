import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { chatService } from '@service/db/chat.service';
import { ChatCache } from '@service/redis/chat.cache';
import { IMessageData } from '@chat/interfaces/message.interface';
import { MessageModel } from '@chat/models/message.schema';
import { NotFoundError } from '@global/helpers/error-handler';

const chatCache: ChatCache = new ChatCache();

class Get {
  // 1. Get Conversation List (Inbox)
  public async conversationList(req: Request, res: Response): Promise<void> {
    const list = await chatService.getUserConversationList(req.currentUser!.userId);

    res.status(HTTP_STATUS.OK).json({
      message: 'User conversation list',
      conversations: list
    });
  }

  // 2. Get Messages (Chat Window)
  public async messages(req: Request, res: Response): Promise<void> {
    const { userId } = req.currentUser!;
    const { receiverId } = req.params;
    const { conversationId } = req.query;
    const { page = 1, limit = 25 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    let messages: IMessageData[] = [];

    if (conversationId) {
      const cachedList = await chatCache.getMessagesFromCache(`${conversationId}`, 0, -1, userId);

      // TODO get replyto message and populate it from cache first
      if (cachedList.length > 0) {
        const startIndex = (Number(page) - 1) * Number(limit);
        const endIndex = startIndex + Number(limit);
        if (cachedList.length >= endIndex) {
          messages = cachedList.slice(startIndex, endIndex);

          let msgPromises = messages.map(async (m) => {
            if (m.replyTo) {
              const repliedMessage = await MessageModel.findById(m.replyTo);
              if (!repliedMessage) throw new NotFoundError('Replied Message Not Found.');
              m.replyTo = {
                _id: repliedMessage._id,
                body: repliedMessage.body,
                senderId: repliedMessage.senderId,
                type: repliedMessage.type
              };
            }

            return m;
          });

          messages = await Promise.all(msgPromises);
        }

      }
    }

    if (messages.length === 0) {
      const mongoMessages = await chatService.getMessages(
        req.currentUser!.userId,
        receiverId,
        conversationId as string,
        skip,
        Number(limit)
      );

      messages = mongoMessages as unknown as IMessageData[];
    }

    res.status(HTTP_STATUS.OK).json({ message: 'Chat messages', messages });
  }
}

export const get: Get = new Get();
