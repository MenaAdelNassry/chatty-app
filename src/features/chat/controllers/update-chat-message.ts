import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { socketIOChatObject } from '@socket/chat';
import { markChatSchema } from '@chat/schemes/chat';
import { joiRequestValidationError } from '@global/helpers/error-handler';
import { chatService } from '@service/db/chat.service';

class Update {
  public async message(req: Request, res: Response): Promise<void> {
    const { error } = markChatSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    const { conversationId, socketId, messageId } = req.body;
    const readerId = req.currentUser!.userId;

    // 2. Database Update
    const updatedConversation = await chatService.markMessageAsRead(readerId, conversationId, messageId);

    // 3. Socket Emission ⚡
    // Send a message to the other party (the one who sent the messages) telling them, "Your messages have been read."
    // Send it to myself too (because if you're using a mobile phone, the counter will reset there instantly)
    socketIOChatObject.to(conversationId).except(socketId).emit('message read', {
      conversationId: updatedConversation?._id,
      unreadCounts: updatedConversation?.unreadCounts,
      lastRead: updatedConversation?.lastRead,
      readMessageId: messageId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Message marked as read' });
  }
}

export const update: Update = new Update();
