import { authUserPayload } from '@root/mocks/auth.mock';
import { chatMockRequest, chatMockResponse, messageDataMock } from '@root/mocks/chat.mock';
import { MessageCache } from '@service/redis/message.cache';
import { Request, Response } from 'express';
import { get } from '@chat/controllers/get-chat-message';
import { chatService } from '@service/db/chat.service';
import mongoose from 'mongoose';

// 1. Mock External Dependencies
jest.mock('@service/redis/message.cache');
jest.mock('@service/db/chat.service');

describe('Get Chat Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // 1. Test for conversationList
  // ==========================================
  describe('conversationList', () => {
    it('should return conversation list from CACHE if available', async () => {
      const req: Request = chatMockRequest({}, {}, authUserPayload) as Request;
      const res: Response = chatMockResponse();
      const mockList = [messageDataMock];

      jest.spyOn(MessageCache.prototype, 'getUserConversationList').mockResolvedValue(mockList);

      await get.conversationList(req, res);

      expect(MessageCache.prototype.getUserConversationList).toHaveBeenCalledWith(req.currentUser!.userId);
      expect(chatService.getUserConversationList).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User conversation list',
        conversationUserList: mockList
      });
    });

    it('should return conversation list from DB if cache is empty', async () => {
      const req: Request = chatMockRequest({}, {}, authUserPayload) as Request;
      const res: Response = chatMockResponse();
      const mockList = [messageDataMock];

      jest.spyOn(MessageCache.prototype, 'getUserConversationList').mockResolvedValue([]);
      jest.spyOn(chatService, 'getUserConversationList').mockResolvedValue(mockList);

      await get.conversationList(req, res);

      expect(MessageCache.prototype.getUserConversationList).toHaveBeenCalledWith(req.currentUser!.userId);
      expect(chatService.getUserConversationList).toHaveBeenCalledWith(req.currentUser!.userId);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User conversation list',
        conversationUserList: mockList
      });
    });
  });

  // ==========================================
  // 2. Test for messages
  // ==========================================
  describe('messages', () => {
    it('should return messages from CACHE if available', async () => {
      // Arrange
      const req: Request = chatMockRequest({}, {}, authUserPayload, { conversationId: '602854c81c9ca7939aaeba43' }) as Request;
      const res: Response = chatMockResponse();
      const mockMessages = [messageDataMock];

      // Mocking: Cache returns data
      jest.spyOn(MessageCache.prototype, 'getChatMessagesFromCache').mockResolvedValue(mockMessages);

      // Act
      await get.messages(req, res);

      // Assert
      expect(MessageCache.prototype.getChatMessagesFromCache).toHaveBeenCalledWith(req.params.conversationId);
      expect(chatService.getMessages).not.toHaveBeenCalled(); // Cache hit
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User chat messages',
        messages: mockMessages
      });
    });

    it('should return messages from DB if cache is empty', async () => {
      // Arrange
      const req: Request = chatMockRequest({}, {}, authUserPayload, { conversationId: '602854c81c9ca7939aaeba43' }) as Request;
      const res: Response = chatMockResponse();
      const mockMessages = [messageDataMock];

      // Mocking: Cache empty
      jest.spyOn(MessageCache.prototype, 'getChatMessagesFromCache').mockResolvedValue([]);
      // Mocking: DB returns data
      jest.spyOn(chatService, 'getMessages').mockResolvedValue(mockMessages);

      // Act
      await get.messages(req, res);

      // Assert
      expect(chatService.getMessages).toHaveBeenCalledWith(req.params.conversationId, { createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User chat messages',
        messages: mockMessages
      });
    });
  });

  // ==========================================
  // 3. Test for checkConversation
  // ==========================================
  describe('checkConversation', () => {
    it('should return conversationId if conversation exists', async () => {
      // Arrange
      const req: Request = chatMockRequest({}, {}, authUserPayload, { receiverId: '60263f14648fed5246e322d8' }) as Request;
      const res: Response = chatMockResponse();
      const mockConversationId = new mongoose.Types.ObjectId();

      // Mocking DB response (object with _id)
      jest.spyOn(chatService, 'getConversationId').mockResolvedValue({
        _id: mockConversationId
      } as any);

      // Act
      await get.checkConversation(req, res);

      // Assert
      expect(chatService.getConversationId).toHaveBeenCalledWith(req.currentUser!.userId, req.params.receiverId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Check conversation',
        conversationId: mockConversationId
      });
    });

    it('should return null conversationId if no conversation found', async () => {
      // Arrange
      const req: Request = chatMockRequest({}, {}, authUserPayload, { receiverId: '60263f14648fed5246e322d8' }) as Request;
      const res: Response = chatMockResponse();

      // Mocking DB returning null (not found)
      jest.spyOn(chatService, 'getConversationId').mockResolvedValue(null as any);

      // Act
      await get.checkConversation(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Check conversation',
        conversationId: null
      });
    });
  });
});
