import { authUserPayload } from "@root/mocks/auth.mock";
import { newPost, postMockRequest, postMockResponse } from "@root/mocks/post.mock";
import { postQueue } from "@service/queues/post.queue";
import { PostCache } from "@service/redis/post.cache";
import * as postServer from "@socket/post"
import { Request, Response } from "express";
import { Server } from "socket.io";
import { create } from "@post/controllers/create-post";
import { CustomError } from "@global/helpers/error-handler";
import * as cloudinaryUploads from "@global/helpers/cloudinary-upload";

jest.useFakeTimers();
jest.mock("@service/queues/post.queue.ts");
jest.mock("@service/redis/post.cache.ts");
jest.mock("@global/helpers/cloudinary-upload.ts");

Object.defineProperties(postServer, {
  socketIOPostObject: {
    value: new Server(),
    writable: true
  }
});

describe('Create', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe("post", () => {
    it("should send correct json response", async () => {
      // ----------------- Arrange -----------------
      const body = { ...newPost };
      const req: Request = postMockRequest(body, authUserPayload) as Request;
      const res: Response = postMockResponse();

      jest.spyOn(postServer.socketIOPostObject, 'emit');
      const spy = jest.spyOn(PostCache.prototype, 'savePostToCache');
      jest.spyOn(postQueue, 'addPostJob');

      // ----------------- Act -----------------
      await create.post(req, res);

      // ----------------- Assert -----------------
      const createdPost = spy.mock.calls[0][0].createdPost;
      expect(postServer.socketIOPostObject.emit).toHaveBeenCalledWith("add post", createdPost);
      expect(PostCache.prototype.savePostToCache).toHaveBeenCalledWith({
        key: spy.mock.calls[0][0].key,
        currentUserId: `${req.currentUser?.userId}`,
        uId: `${req.currentUser?.uId}`,
        createdPost
      });
      expect(postQueue.addPostJob).toHaveBeenCalledWith("addPostToDB", {
        key: req.currentUser?.userId,
        value: createdPost
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Post created successfully" });
    });
  });

  describe("postWithImage", () => {
    it("should throw an error if image is not available", () => {
      const body = { ...newPost };
      delete body.image;
      const req: Request = postMockRequest(body, authUserPayload) as Request;
      const res: Response = postMockResponse();

      create.postWithImage(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual("Image is a required field");
      });
    });

    it("should throw an error if image is empty", () => {
      const body = { ...newPost };
      body.image = '';
      const req: Request = postMockRequest(body, authUserPayload) as Request;
      const res: Response = postMockResponse();

      create.postWithImage(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual("Image property is not allowed to be empty");
      });
    });

    it("should throw an upload error", () => {
      const body = { ...newPost };
      body.image = 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==';
      const req: Request = postMockRequest(body, authUserPayload) as Request ;
      const res: Response = postMockResponse();

      jest
        .spyOn(cloudinaryUploads, 'uploads')
        .mockImplementation((): any => Promise.resolve({ version: '', public_id: '', message: 'Upload error' }));

      create.postWithImage(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual("Upload error");
      });
    });

    it("should send correct json response", async () => {
      // ----------------- Arrange -----------------
      const body = { ...newPost };
      body.image = "testing image";
      const req: Request = postMockRequest(body, authUserPayload) as Request;
      const res: Response = postMockResponse();

      jest.spyOn(cloudinaryUploads, 'uploads').mockImplementation((): any => Promise.resolve({ version: '1234', public_id: '123456' }));
      jest.spyOn(postServer.socketIOPostObject, 'emit');
      const spy = jest.spyOn(PostCache.prototype, 'savePostToCache');
      jest.spyOn(postQueue, 'addPostJob');

      // ----------------- Act -----------------
      await create.postWithImage(req, res);

      // ----------------- Assert -----------------
      const createdPost = spy.mock.calls[0][0].createdPost;
      expect(postServer.socketIOPostObject.emit).toHaveBeenCalledWith('add post', createdPost);
      expect(PostCache.prototype.savePostToCache).toHaveBeenCalledWith({
        key: spy.mock.calls[0][0].key,
        currentUserId: `${req.currentUser?.userId}`,
        uId: `${req.currentUser?.uId}`,
        createdPost,
      });
      expect(postQueue.addPostJob).toHaveBeenCalledWith("addPostToDB", {
        key: `${req.currentUser?.userId}`,
        value: createdPost
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Post created with image successfully'
      });
    });
  });
});
