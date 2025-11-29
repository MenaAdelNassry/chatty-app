import { authUserPayload } from '@root/mocks/auth.mock';
import { chatMockRequest, chatMockResponse, messageDataMock, mockMessageId } from '@root/mocks/chat.mock';
import { Request, Response } from 'express';
import { update } from '@chat/controllers/update-chat-message';
import { MessageCache } from '@service/redis/message.cache';
import * as chatServer from '@socket/chat';
import { Server } from 'socket.io';
import { chatQueue } from '@service/queues/chat.queue';

// 1. Mocking External Dependencies
jest.mock('@service/redis/message.cache');
jest.mock('@service/queues/chat.queue');
jest.mock('@socket/chat');

Object.defineProperties(chatServer, {
  socketIOChatObject: {
    value: new Server(),
    writable: true
  }
});

describe('Update Controller', () => {
  // 2. Clear mocks before each test
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('markMessageAsRead', () => {
    it('should send updated message to socket and queue', async () => {
      // Arrange
      const req: Request = chatMockRequest({}, {}, authUserPayload, { conversationId: '602854c81c9ca7939aaeba43' }) as Request;
      const res: Response = chatMockResponse();

      // Mocking dependencies behaviors
      jest.spyOn(MessageCache.prototype, 'markMessagesAsRead').mockResolvedValue(messageDataMock);
      jest.spyOn(chatServer.socketIOChatObject, 'emit');
      jest.spyOn(chatQueue, 'addChatJob');

      // Act
      await update.markMessageAsRead(req, res);

      // Assert
      expect(MessageCache.prototype.markMessagesAsRead).toHaveBeenCalledWith(req.params.conversationId, req.currentUser!.userId);

      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('message read', messageDataMock);
      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('chat list', messageDataMock);

      expect(chatQueue.addChatJob).toHaveBeenCalledWith('markMessageAsReadToDB', {
        conversationId: req.params.conversationId,
        receiverId: req.currentUser!.userId
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Message marked as read' });
    });
  });
});
