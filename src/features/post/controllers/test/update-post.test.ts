import HTTP_STATUS from 'http-status-codes';
import { authUserPayload } from "@root/mocks/auth.mock";
import { postMockData, postMockRequest, postMockResponse, updatedPost } from "@root/mocks/post.mock";
import { postQueue } from "@service/queues/post.queue";
import { PostCache } from "@service/redis/post.cache";
import * as postServer from "@socket/post"
import { Request, Response } from "express";
import { Server } from "socket.io";
import { update } from "@post/controllers/update-post";
import * as cloudinaryUploads from "@global/helpers/cloudinary-upload"

jest.useFakeTimers();
jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/post.cache');
jest.mock('@global/helpers/cloudinary-upload');

Object.defineProperties(postServer, {
  socketIOPostObject: {
    value: new Server(),
    writable: true
  }
});

describe('Update', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe("post", () => {
    it('should update post and send correct json response', async () => {
      const req: Request = postMockRequest(updatedPost, authUserPayload, { postId: `${postMockData._id}` }) as Request;
      const res: Response = postMockResponse();

      const postCacheSpy = jest.spyOn(PostCache.prototype, 'updatePostInCache').mockResolvedValue(postMockData);
      const socketSpy = jest.spyOn(postServer.socketIOPostObject, 'emit');
      const queueSpy = jest.spyOn(postQueue, 'addPostJob');

      await update.post(req, res);

      expect(postCacheSpy).toHaveBeenCalledWith(`${postMockData._id}`, expect.objectContaining(updatedPost));
      expect(socketSpy).toHaveBeenCalledWith('update post', postMockData, 'posts');
      expect(queueSpy).toHaveBeenCalledWith('updatePostInDB', { key: `${postMockData._id}`, value: postMockData });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Post updated successfully' });
    });
  });

  describe("postWithImage", () => {
    it('should upload NEW image and update post', async () => {
      const newImageBody = {
        ...updatedPost,
        image: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==', // صورة جديدة
        imgId: '',
        imgVersion: ''
      };
      const req: Request = postMockRequest(newImageBody, authUserPayload, { postId: `${postMockData._id}` }) as Request;
      const res: Response = postMockResponse();

      // Spies
      const cloudinarySpy = jest.spyOn(cloudinaryUploads, 'uploads').mockImplementation((): any =>
        Promise.resolve({ version: '9999', public_id: 'new_image_id' })
      );
      const postCacheSpy = jest.spyOn(PostCache.prototype, 'updatePostInCache').mockResolvedValue(postMockData);
      const socketSpy = jest.spyOn(postServer.socketIOPostObject, 'emit');
      const queueSpy = jest.spyOn(postQueue, 'addPostJob');

      // Act
      await update.postWithImage(req, res);

      // Assert
      expect(cloudinarySpy).toHaveBeenCalledWith(newImageBody.image);
      expect(postCacheSpy).toHaveBeenCalledWith(`${postMockData._id}`, expect.objectContaining({
        imgId: 'new_image_id',
        imgVersion: '9999'
      }));
      expect(socketSpy).toHaveBeenCalledWith('update post', postMockData, 'posts');
      expect(queueSpy).toHaveBeenCalledWith('updatePostInDB', { key: `${postMockData._id}`, value: postMockData });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Post with image updated successfully' });
    });

    it('should use EXISTING image and update post (No Upload)', async () => {
      const existingImageBody = {
        ...updatedPost,
        image: 'https://cloudinary.com/my-image.jpg',
        imgId: 'old_image_id',
        imgVersion: '1234'
      };
      const req: Request = postMockRequest(existingImageBody, authUserPayload, { postId: `${postMockData._id}` }) as Request;
      const res: Response = postMockResponse();

      // Spies
      const cloudinarySpy = jest.spyOn(cloudinaryUploads, 'uploads');
      const postCacheSpy = jest.spyOn(PostCache.prototype, 'updatePostInCache').mockResolvedValue(postMockData);
      const socketSpy = jest.spyOn(postServer.socketIOPostObject, 'emit');
      const queueSpy = jest.spyOn(postQueue, 'addPostJob');

      // Act
      await update.postWithImage(req, res);

      // Assert
      expect(cloudinarySpy).not.toHaveBeenCalled();
      expect(postCacheSpy).toHaveBeenCalledWith(`${postMockData._id}`, expect.objectContaining({
        imgId: 'old_image_id',
        imgVersion: '1234'
      }));
      expect(socketSpy).toHaveBeenCalledWith('update post', postMockData, 'posts');
      expect(queueSpy).toHaveBeenCalledWith('updatePostInDB', { key: `${postMockData._id}`, value: postMockData });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Post with image updated successfully' });
    });
  });
});
