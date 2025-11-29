import { del } from '@chat/controllers/delete-chat-message';
import { chatMockRequest, chatMockResponse, messageDataMock, mockMessageId } from '@root/mocks/chat.mock';
import { MessageCache } from '@service/redis/message.cache';
import { chatQueue } from '@service/queues/chat.queue';
import { authUserPayload } from '@root/mocks/auth.mock';
import { Request, Response } from 'express';
import * as chatServer from "@socket/chat"
import { Server } from 'socket.io';

// 1. Mock External Dependencies
jest.mock('@service/redis/message.cache');
jest.mock('@service/queues/chat.queue');
jest.mock('@socket/chat');

Object.defineProperties(chatServer, {
  socketIOChatObject: {
    value: new Server,
    writable: true
  }
});

describe('Delete Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('markMessageAsDeleted', () => {
    it('should send updated message to socket and queue', async () => {
      const req: Request = chatMockRequest(
        {},
        {},
        authUserPayload,
        {
          conversationId: '602854c81c9ca7939aaeba43',
          messageId: `${mockMessageId}`,
          type: 'deleteForMe'
        }
      ) as Request;
      const res: Response = chatMockResponse();

      // Mocking dependencies behaviors
      jest.spyOn(MessageCache.prototype, 'markMessageAsDeleted').mockResolvedValue(messageDataMock);
      jest.spyOn(chatServer.socketIOChatObject, 'emit');
      jest.spyOn(chatQueue, 'addChatJob');

      await del.markMessageAsDeleted(req, res);

      expect(MessageCache.prototype.markMessageAsDeleted).toHaveBeenCalledWith(
        req.params.conversationId,
        req.params.messageId,
        req.params.type
      );

      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('message deleted', messageDataMock);
      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('chat list', messageDataMock);

      expect(chatQueue.addChatJob).toHaveBeenCalledWith('markMessageAsDeletedToDB', {
        messageId: req.params.messageId,
        type: req.params.type
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Message marked as deleted' });
    });
  });
});
