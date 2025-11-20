import { authUserPayload } from "@root/mocks/auth.mock";
import { commentMockRequest, commentMockResponse, mockComment, mockNameList } from "@root/mocks/comment.mock";
import { commentService } from "@service/db/comment.service";
import { CommentCache } from "@service/redis/comment.cache";
import { Request } from "express";
import { get } from '@comment/controllers/get-comments';
import HTTP_STATUS from 'http-status-codes';
import mongoose from "mongoose";

jest.useFakeTimers();
jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/comment.cache');

describe("Get", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("comments", () => {
    it('should return comments from CACHE if available', async () => {
      const req: Request = commentMockRequest({}, {}, authUserPayload, { postId: `${mockComment.postId}` }) as unknown as Request;
      const res: Response = commentMockResponse() as unknown as Response;

      jest.spyOn(CommentCache.prototype, 'getCommentsFromCache').mockResolvedValue([mockComment]);
      const dbSpy = jest.spyOn(commentService, 'getPostComments');

      await get.comments(req, res as any);

      expect(CommentCache.prototype.getCommentsFromCache).toHaveBeenCalledWith(mockComment.postId);
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Post comments',
        comments: [mockComment]
      });
    });

    it('should return comments from DB if cache is empty', async () => {
      const req: Request = commentMockRequest({}, {}, authUserPayload, { postId: `${mockComment.postId}` }) as Request;
      const res: Response = commentMockResponse() as unknown as Response;

      jest.spyOn(CommentCache.prototype, 'getCommentsFromCache').mockResolvedValue([]);
      jest.spyOn(commentService, 'getPostComments').mockResolvedValue([mockComment]);

      await get.comments(req, res as any);

      expect(commentService.getPostComments).toHaveBeenCalledWith(
        { postId: expect.any(mongoose.Types.ObjectId) },
        { createdAt: -1 }
      );
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Post comments',
        comments: [mockComment]
      });
    });
  });

  describe("commentsNamesFromCache", () => {
    it('should return names from CACHE if available', async () => {
      const req: Request = commentMockRequest({}, {}, authUserPayload, { postId: `${mockComment.postId}` }) as Request;
      const res: Response = commentMockResponse() as unknown as Response;

      jest.spyOn(CommentCache.prototype, 'getCommentsNamesFromCache').mockResolvedValue(mockNameList);
      const dbSpy = jest.spyOn(commentService, 'getPostCommentNames');

      await get.commentsNamesFromCache(req, res as any);

      expect(CommentCache.prototype.getCommentsNamesFromCache).toHaveBeenCalledWith(`${mockComment.postId}`);
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Post comments names',
        comments: mockNameList.names
      });
    });

    it('should return names from DB if cache is empty', async () => {
      const req: Request = commentMockRequest({}, {}, authUserPayload, { postId: `${mockComment.postId}` }) as Request;
      const res: Response = commentMockResponse() as unknown as Response;

      jest.spyOn(CommentCache.prototype, 'getCommentsNamesFromCache').mockResolvedValue({ count: 0, names: [] });
      jest.spyOn(commentService, 'getPostCommentNames').mockResolvedValue(mockNameList);

      await get.commentsNamesFromCache(req, res as any);

      expect(commentService.getPostCommentNames).toHaveBeenCalledWith({ postId: expect.any(mongoose.Types.ObjectId) });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Post comments names',
        comments: mockNameList.names
      });
    });
  });

  describe('singleComment', () => {
    it('should return single comment from CACHE', async () => {
      const req: Request = commentMockRequest({}, {}, authUserPayload, { postId: '123', commentId: '456' }) as Request;
      const res: Response = commentMockResponse() as unknown as Response;

      jest.spyOn(CommentCache.prototype, 'getSingleCommentFromCache').mockResolvedValue(mockComment);
      const dbSpy = jest.spyOn(commentService, 'getPostComments');

      await get.singleComment(req, res as any);

      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Single comment',
        comments: [mockComment]
      });
    });

    it('should return single comment from DB if cache miss', async () => {
      const req: Request = commentMockRequest({}, {}, authUserPayload, { postId: '691b24cad3cdf70067b5aa09', commentId: '691f61313558039b1d0741e0' }) as Request;
      const res: Response = commentMockResponse() as unknown as Response;

      jest.spyOn(CommentCache.prototype, 'getSingleCommentFromCache').mockResolvedValue(null);
      jest.spyOn(commentService, 'getPostComments').mockResolvedValue([mockComment]);

      await get.singleComment(req, res as any);

      expect(commentService.getPostComments).toHaveBeenCalledWith(
        { _id: expect.any(mongoose.Types.ObjectId) },
        { createdAt: -1 }
      );
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Single comment',
        comments: [mockComment]
      });
    });
  });
});
