import { Request, Response } from 'express';
import { authUserPayload } from '@root/mocks/auth.mock';
import { commentMockRequest, commentMockResponse } from '@root/mocks/comment.mock';
import { CommentCache } from '@service/redis/comment.cache';
import { commentQueue } from '@service/queues/comment.queue';
import { add } from '@comment/controllers/add-comment';
import { CustomError } from '@global/helpers/error-handler';
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/comment.cache');

describe('Add Comment Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should throw an error if comment is not exist', async () => {
    const req: Request = commentMockRequest(
      {},
      { postId: '123', userTo: '456', profilePicture: 'http://img.com' },
      authUserPayload
    ) as Request;
    const res: Response = commentMockResponse();

    // Act & Assert
    await add.comment(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('comment is a required property');
    });
  });

  it('should call cache, queue, and send correct response', async () => {
    // Arrange
    const mockBody = {
      postId: '6027f77087c9d9ccb1555268',
      comment: 'This is a nice post',
      profilePicture: 'http://place-hold.it/500x500',
      userTo: '60263f14648fed5246e322d9'
    };

    const req: Request = commentMockRequest({}, mockBody, authUserPayload) as Request;
    const res: Response = commentMockResponse();

    const cacheSpy = jest.spyOn(CommentCache.prototype, 'savePostCommentToCache');
    const queueSpy = jest.spyOn(commentQueue, 'addCommentJob');

    await add.comment(req, res);

    expect(cacheSpy).toHaveBeenCalledWith(
      mockBody.postId,
      expect.objectContaining({
        postId: mockBody.postId,
        comment: mockBody.comment,
        username: authUserPayload.username,
        avatarColor: authUserPayload.avatarColor,
        profilePicture: mockBody.profilePicture
      })
    );

    expect(queueSpy).toHaveBeenCalledWith(
      'addCommentToDB',
      expect.objectContaining({
        postId: mockBody.postId,
        userFrom: authUserPayload.userId,
        userTo: mockBody.userTo,
        username: authUserPayload.username
      })
    );

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Comment created successfully'
    });
  });
});
