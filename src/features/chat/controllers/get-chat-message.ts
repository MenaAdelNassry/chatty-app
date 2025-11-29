import { IMessageData } from '@chat/interfaces/message.interface';
import { chatService } from '@service/db/chat.service';
import { MessageCache } from '@service/redis/message.cache';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

const messageCache: MessageCache = new MessageCache();

class Get {
  public conversationList = async (req: Request, res: Response): Promise<void> => {
    let conversationUserList: IMessageData[] = [];
    const cachedConversationList: IMessageData[] = await messageCache.getUserConversationList(`${req.currentUser!.userId}`);

    if (!cachedConversationList.length) {
      conversationUserList = await chatService.getUserConversationList(`${req.currentUser!.userId}`);
    } else {
      conversationUserList = cachedConversationList;
    }

    res.status(HTTP_STATUS.OK).json({ message: 'User conversation list', conversationUserList });
  };

  // -------------------------------------------------------------------------
  // TODO: ⚠️ PERFORMANCE RISK (No Pagination)
  // Currently fetching ALL messages (0 to -1).
  // If a chat has 10k+ messages, this request will be extremely slow and heavy.
  // FUTURE FIX: Implement Pagination (skip/limit) using scrolling logic.
  // -------------------------------------------------------------------------
  public messages = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.params;

    let messages: IMessageData[] = [];
    const cachedMessages: IMessageData[] = await messageCache.getChatMessagesFromCache(conversationId);

    if (!cachedMessages.length) {
      messages = await chatService.getMessages(conversationId, { createdAt: -1 });
    } else {
      messages = cachedMessages;
    }

    res.status(HTTP_STATUS.OK).json({ message: 'User chat messages', messages });
  };

  public checkConversation = async (req: Request, res: Response): Promise<void> => {
    const { receiverId } = req.params;
    const senderId = req.currentUser!.userId;

    const conversation = await chatService.getConversationId(senderId, receiverId);

    res.status(HTTP_STATUS.OK).json({
      message: 'Check conversation',
      conversationId: conversation ? conversation._id : null
    });
  }
}

export const get: Get = new Get();
