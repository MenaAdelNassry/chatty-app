import { IMessageData, TDeletedMessage } from '@chat/interfaces/message.interface';
import { chatQueue } from '@service/queues/chat.queue';
import { MessageCache } from '@service/redis/message.cache';
import { socketIOChatObject } from '@socket/chat';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

const messageCache: MessageCache = new MessageCache();

class Delete {
  // -------------------------------------------------------------------------
  // TODO: ⚠️ PRIVACY & SECURITY DEBT (Soft Delete Flaw)
  //
  // Current Logic:
  // We only toggle `deleteForMe` or `deleteForEveryone` flags to TRUE.
  // We DO NOT remove or scrub the actual message `body` content.
  //
  // Risks:
  // 1. Data Leakage: The original text still exists in both Redis & MongoDB.
  //    If the API response sends the full object, a savvy user can see the "deleted"
  //    text by inspecting the Network Tab.
  // 2. GDPR Compliance: "Deleted" messages are not truly deleted from storage.
  //
  // FUTURE FIX (In Cache & DB Services):
  // When `deleteForEveryone` is triggered, we must explicitly replace the `body`
  // with a placeholder string (e.g., "This message was deleted") in both
  // `MessageCache.markMessageAsDeleted` and `ChatService.markMessageAsDeleted`.
  // -------------------------------------------------------------------------
  public markMessageAsDeleted = async (req: Request, res: Response): Promise<void> => {
    const { conversationId, type, messageId } = req.params;
    const updatedMessage: IMessageData = await messageCache.markMessageAsDeleted(conversationId, messageId, type as TDeletedMessage);

    socketIOChatObject.emit('message deleted', updatedMessage);
    socketIOChatObject.emit('chat list', updatedMessage);

    chatQueue.addChatJob('markMessageAsDeletedToDB', {
      type,
      messageId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Message marked as deleted' });
  };
}

export const del: Delete = new Delete();
