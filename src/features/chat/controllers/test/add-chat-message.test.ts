import { add } from '@chat/controllers/add-chat-message';
import { chatMockRequest, chatMockResponse, mockMessageId } from '@root/mocks/chat.mock';
import { MessageCache } from '@service/redis/message.cache';
import { UserCache } from '@service/redis/user.cache';
import { chatQueue } from '@service/queues/chat.queue';
import { emailQueue } from '@service/queues/email.queue';
import * as chatServer from '@socket/chat';
import * as cloudinaryUploads from '@global/helpers/cloudinary-upload'; // Mocking cloudinary
import { authUserPayload } from '@root/mocks/auth.mock';
import { existingUser } from '@root/mocks/user.mock';
import { BadRequestError } from '@global/helpers/error-handler';
import { Server } from 'socket.io';
import { Request, Response } from 'express';

// 1. Mock External Dependencies
jest.mock('@service/redis/message.cache');
jest.mock('@service/redis/user.cache');
jest.mock('@service/queues/chat.queue');
jest.mock('@service/queues/email.queue');

Object.defineProperties(chatServer, {
  socketIOChatObject: {
    value: new Server,
    writable: true
  }
});

describe('Add Chat Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  // ==========================================
  // 1. Test for message()
  // ==========================================
  describe('message', () => {
    // Basic body data
    const validBody = {
      conversationId: '602854c81c9ca7939aaeba43',
      receiverId: '60263f14648fed5246e322d8',
      receiverUsername: 'Danny',
      receiverAvatarColor: 'red',
      receiverProfilePicture: 'http://cloudinary.com',
      body: 'Hello World',
      gifUrl: '',
      isRead: false,
      selectedImage: ''
    };

    it('should throw error if body is invalid', async () => {
      const req: Request = chatMockRequest({}, { ...validBody, body: '' }, authUserPayload) as Request; // Invalid body (empty)
      const res: Response = chatMockResponse();

      await expect(add.message(req, res)).rejects.toThrow();
    });

    it('should upload image if selectedImage exists', async () => {
      const req: Request = chatMockRequest({}, { ...validBody, selectedImage: 'data:image/png;base64,...' }, authUserPayload) as Request;
      const res: Response = chatMockResponse();

      // Mock User Cache (Sender)
      jest.spyOn(UserCache.prototype, 'getUserFromCache').mockResolvedValue(existingUser);
      // Mock Cloudinary Upload
      jest.spyOn(cloudinaryUploads, 'uploads').mockResolvedValue({ public_id: '1234', version: 1234 } as any);

      // We assume rest of the flow works, we just check upload call
      await add.message(req, res);

      expect(cloudinaryUploads.uploads).toHaveBeenCalledWith(
        req.body.selectedImage,
        expect.anything(),
        true,
        true
      );
    });

    it('should send email notification if receiver notifications are ON', async () => {
      const req: Request = chatMockRequest({}, { ...validBody, isRead: false }, authUserPayload) as Request;
      const res: Response = chatMockResponse();

      // Mock Sender (from cache)
      jest.spyOn(UserCache.prototype, 'getUserFromCache')
        .mockResolvedValueOnce(existingUser) // 1st call: Sender
        .mockResolvedValueOnce({ ...existingUser, notifications: { messages: true, comments: true, follows: true, reactions: true } } as any); // 2nd call: Receiver (for email check)

      await add.message(req, res);

      expect(emailQueue.addEmailJob).toHaveBeenCalledWith('directMessageEmail', expect.anything());
    });

    it('should add message to cache, queue, and emit socket', async () => {
      const req: Request = chatMockRequest({}, validBody, authUserPayload) as Request;
      const res: Response = chatMockResponse();

      jest.spyOn(UserCache.prototype, 'getUserFromCache').mockResolvedValue(existingUser);
      jest.spyOn(MessageCache.prototype, 'addChatListToCache');
      jest.spyOn(MessageCache.prototype, 'addChatMessageToCache');
      jest.spyOn(chatServer.socketIOChatObject, 'emit');

      await add.message(req, res);

      // Verify Socket
      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('message received', expect.anything());
      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('chat list', expect.anything());

      // Verify Cache
      expect(MessageCache.prototype.addChatListToCache).toHaveBeenCalledTimes(2); // Sender & Receiver
      expect(MessageCache.prototype.addChatMessageToCache).toHaveBeenCalled();

      // Verify Queue
      expect(chatQueue.addChatJob).toHaveBeenCalledWith('addChatMessageToDB', expect.anything());

      // Verify Response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Message added',
        conversationId: expect.anything() // ObjectId
      });
    });
  });

  // ==========================================
  // 2. Test for addChatUsers()
  // ==========================================
  describe('addChatUsers', () => {
    it('should add chat users to cache and emit socket', async () => {
      const req: Request = chatMockRequest({}, { userOne: 'A', userTwo: 'B' }, authUserPayload) as Request;
      const res: Response = chatMockResponse();
      const mockUsers = [{ userOne: 'A', userTwo: 'B' }];

      jest.spyOn(MessageCache.prototype, 'addChatUsersToCache').mockResolvedValue(mockUsers);
      jest.spyOn(chatServer.socketIOChatObject, 'emit');

      await add.addChatUsers(req, res);

      expect(MessageCache.prototype.addChatUsersToCache).toHaveBeenCalledWith(req.body);
      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('add chat users', mockUsers);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Users added' });
    });
  });

  // ==========================================
  // 3. Test for removeChatUsers()
  // ==========================================
  describe('removeChatUsers', () => {
    it('should remove chat users from cache and emit socket', async () => {
      const req: Request = chatMockRequest({}, { userOne: 'A', userTwo: 'B' }, authUserPayload) as Request;
      const res: Response = chatMockResponse();
      const mockUsers = [{userOne: 'A', userTwo: 'C'}]; // Assuming one left

      jest.spyOn(MessageCache.prototype, 'removeChatUsersFromCache').mockResolvedValue(mockUsers);
      jest.spyOn(chatServer.socketIOChatObject, 'emit');

      await add.removeChatUsers(req, res);

      expect(MessageCache.prototype.removeChatUsersFromCache).toHaveBeenCalledWith(req.body);
      expect(chatServer.socketIOChatObject.emit).toHaveBeenCalledWith('add chat users', mockUsers);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Users removed' });
    });
  });
});
