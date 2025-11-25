import { Request, Response } from 'express';
import { Server } from 'socket.io';
import * as imageServer from '@socket/image';
import { authUserPayload } from '@root/mocks/auth.mock';
import { imageMockRequest, imageMockResponse } from '@root/mocks/image.mock';
import { imageQueue } from '@service/queues/image.queue';
import { UserCache } from '@service/redis/user.cache';
import { add } from '@image/controllers/add-image';
import HTTP_STATUS from 'http-status-codes';
import * as cloudinaryUploads from '@global/helpers/cloudinary-upload';
import { existingUser } from '@root/mocks/user.mock';

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/user.cache');
jest.mock('@service/queues/image.queue');
jest.mock('@global/helpers/cloudinary-upload');

Object.defineProperties(imageServer, {
  socketIOImageObject: {
    value: new Server(),
    writable: true
  }
});

describe('Add Image Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('profileImage', () => {
    it('should upload image, update cache, and emit socket event', async () => {
      // Arrange
      const req: Request = imageMockRequest(
        { image: 'data:image/png;base64,TEST' }, // Base64 Image
        authUserPayload
      ) as Request;
      const res: Response = imageMockResponse();

      // Spies
      jest.spyOn(cloudinaryUploads, 'uploads').mockImplementation((): any =>
        Promise.resolve({ version: '1234', public_id: req.currentUser!.userId }) // Cloudinary Success
      );
      const cacheSpy = jest.spyOn(UserCache.prototype, 'updateUserItemsInCache').mockResolvedValue(existingUser);
      const socketSpy = jest.spyOn(imageServer.socketIOImageObject, 'emit');
      const queueSpy = jest.spyOn(imageQueue, 'addImageJob');

      // Act
      await add.profileImage(req, res);

      // Assert
      expect(cacheSpy).toHaveBeenCalledWith(req.currentUser!.userId, {
        profilePicture: expect.stringContaining(req.currentUser!.userId)
      });

      expect(socketSpy).toHaveBeenCalledWith('update user', existingUser);

      expect(queueSpy).toHaveBeenCalledWith('addUserProfileImageToDB', {
        key: req.currentUser!.userId,
        value: expect.stringContaining('https://res.cloudinary.com'),
        publicId: req.currentUser!.userId,
        version: '1234'
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Image added successfully' });
    });
  });

  describe('backgroundImage', () => {
    it('should upload NEW background image', async () => {
      const req: Request = imageMockRequest(
        { image: 'data:image/png;base64,TEST' },
        authUserPayload
      ) as Request;
      const res: Response = imageMockResponse();

      const cloudinarySpy = jest.spyOn(cloudinaryUploads, 'uploads').mockImplementation((): any =>
        Promise.resolve({ version: '9999', public_id: 'bg-123' })
      );
      jest.spyOn(UserCache.prototype, 'updateUserItemsInCache').mockResolvedValue(existingUser);
      const queueSpy = jest.spyOn(imageQueue, 'addImageJob');

      await add.backgroundImage(req, res);

      expect(cloudinarySpy).toHaveBeenCalled(); // اتأكدنا إنها اترفعت
      expect(queueSpy).toHaveBeenCalledWith('addBackgroundImageToDB', {
        key: req.currentUser!.userId,
        publicId: 'bg-123',
        version: '9999'
      });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    });

    it('should handle EXISTING background image (URL)', async () => {
      const existingUrl = 'https://res.cloudinary.com/demo/image/upload/v1111/old-bg';
      const req: Request = imageMockRequest(
        { image: existingUrl }, // URL مش Base64
        authUserPayload
      ) as Request;
      const res: Response = imageMockResponse();

      const cloudinarySpy = jest.spyOn(cloudinaryUploads, 'uploads');
      const queueSpy = jest.spyOn(imageQueue, 'addImageJob');
      jest.spyOn(UserCache.prototype, 'updateUserItemsInCache').mockResolvedValue(existingUser);

      await add.backgroundImage(req, res);

      expect(cloudinarySpy).not.toHaveBeenCalled();

      expect(queueSpy).toHaveBeenCalledWith('addBackgroundImageToDB', {
        key: req.currentUser!.userId,
        publicId: 'old-bg',
        version: '1111'
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    });
  });
});
