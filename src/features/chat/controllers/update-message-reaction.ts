import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { MessageCache } from '@service/redis/message.cache';
import { IMessageData } from '@chat/interfaces/message.interface';
import { socketIOChatObject } from '@socket/chat';
import { chatQueue } from '@service/queues/chat.queue';
import { addMessageReactionSchema } from '@chat/schemes/chat';
import { joiRequestValidationError } from '@global/helpers/error-handler';

const messageCache: MessageCache = new MessageCache();

class Message {
  public async reaction(req: Request, res: Response): Promise<void> {
    const { value, error } = addMessageReactionSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    const { conversationId, messageId, reaction, type } = value;
    const updatedMessage: IMessageData = await messageCache.updateMessageReaction(
      messageId,
      conversationId,
      type,
      req.currentUser!.username,
      reaction
    );
    socketIOChatObject.emit('message reaction', updatedMessage);
    chatQueue.addChatJob('updateMessageReactionToDB', {
      messageId,
      senderName: req.currentUser!.username,
      reaction,
      type
    });
    res.status(HTTP_STATUS.OK).json({ message: 'Message reaction updated' });
  }
}

export const message: Message = new Message();
