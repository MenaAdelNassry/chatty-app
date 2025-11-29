import { authUserPayload } from '@root/mocks/auth.mock';
import { chatMockRequest, chatMockResponse, messageDataMock, mockMessageId } from '@root/mocks/chat.mock';
import { Request, Response } from 'express';
import { message } from '@chat/controllers/update-message-reaction';
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

describe('Message Controller', () => {
  // 2. Clear mocks before each test
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('reaction', () => {
    it('should throw an error if request body is invalid', async () => {
      // Arrange
      const req: Request = chatMockRequest({}, {}, authUserPayload) as Request;
      const res: Response = chatMockResponse();

      // Act & Assert
      await expect(message.reaction(req, res)).rejects.toThrow();
    });

    it('should send reaction to redis, queue, and socket if body is valid', async () => {
      // Arrange
      const body = {
        conversationId: '602854c81c9ca7939aaeba43',
        messageId: `${mockMessageId}`,
        reaction: 'love',
        type: 'add'
      };
      const req: Request = chatMockRequest({}, body, authUserPayload) as Request;
      const res: Response = chatMockResponse();

      // Mocking dependencies behaviors
      jest.spyOn(MessageCache.prototype, 'updateMessageReaction').mockResolvedValue(messageDataMock);
      jest.spyOn(chatServer.socketIOChatObject, 'emit');
      jest.spyOn(chatQueue, 'addChatJob');

      // Act
      await message.reaction(req, res);

      // Assert
      expect(MessageCache.prototype.updateMessageReaction).toHaveBeenCalledWith(
        body.messageId,
        body.conversationId,
        body.type,
        req.currentUser!.username,
        body.reaction
      );

      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith("message reaction", messageDataMock);
      expect(chatQueue.addChatJob).toHaveBeenCalledWith("updateMessageReactionToDB", {
        messageId: body.messageId,
        reaction: body.reaction,
        type: body.type,
        senderName: req.currentUser!.username
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Message reaction updated' });
    });
  });
});
