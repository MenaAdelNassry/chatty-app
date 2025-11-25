import { Request, Response } from 'express';
import { Server } from 'socket.io';
import * as imageServer from '@socket/image';
import { authUserPayload } from '@root/mocks/auth.mock';
import { imageMockRequest, imageMockResponse, mockImageDocument } from '@root/mocks/image.mock';
import { imageQueue } from '@service/queues/image.queue';
import { UserCache } from '@service/redis/user.cache';
import { imageService } from '@service/db/image.service';
import { del } from '@image/controllers/delete-image';
import { CustomError } from '@global/helpers/error-handler';
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/user.cache');
jest.mock('@service/queues/image.queue');
jest.mock('@service/db/image.service');

Object.defineProperties(imageServer, {
  socketIOImageObject: {
    value: new Server(),
    writable: true
  }
});

describe('Delete Image Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('image', () => {
    it('should send correct json response and call socket/queue', async () => {
      // Arrange
      const imageId = '60263f14648fed5246e322d9';
      const req: Request = imageMockRequest({}, authUserPayload, { imageId }) as Request;
      const res: Response = imageMockResponse();

      const socketSpy = jest.spyOn(imageServer.socketIOImageObject, 'emit');
      const queueSpy = jest.spyOn(imageQueue, 'addImageJob');

      // Act
      await del.image(req, res);

      // Assert
      expect(socketSpy).toHaveBeenCalledWith('delete image', imageId);
      expect(queueSpy).toHaveBeenCalledWith('removeImageFromDB', { imageId });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Image deleted successfully' });
    });
  });

  describe('backgroundImage', () => {

    it('should update user cache, call socket/queue if image exists', async () => {
      // Arrange
      const bgImageId = 'public-id-123';
      const req: Request = imageMockRequest({}, authUserPayload, { bgImageId }) as Request;
      const res: Response = imageMockResponse();

      jest.spyOn(imageService, 'getImageByBackgroundId').mockResolvedValue(mockImageDocument);

      const socketSpy = jest.spyOn(imageServer.socketIOImageObject, 'emit');
      const cacheSpy = jest.spyOn(UserCache.prototype, 'updateUserItemsInCache');
      const queueSpy = jest.spyOn(imageQueue, 'addImageJob');

      // Act
      await del.backgroundImage(req, res);

      // Assert
      expect(socketSpy).toHaveBeenCalledWith('delete image', mockImageDocument._id);

      expect(cacheSpy).toHaveBeenCalledWith(req.currentUser!.userId, {
        bgImageId: '',
        bgImageVersion: ''
      });

      expect(queueSpy).toHaveBeenCalledWith('removeImageFromDB', {
        imageId: mockImageDocument._id.toString()
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Image deleted successfully' });
    });

    it('should throw BadRequestError if image not found', async () => {
      // Arrange
      const req: Request = imageMockRequest({}, authUserPayload, { bgImageId: 'not-exist' }) as Request;
      const res: Response = imageMockResponse();

      jest.spyOn(imageService, 'getImageByBackgroundId').mockResolvedValue(null);

      // Act & Assert
      await del.backgroundImage(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual('Image not found');
      });
    });
  });
});
