import { authUserPayload } from '@root/mocks/auth.mock';
import { addReactionBody, reactionMockRequest, reactionMockResponse } from '@root/mocks/reactions.mock';
import { reactionQueue } from '@service/queues/reaction.queue';
import { ReactionCache } from '@service/redis/reaction.cache';
import { Request, Response } from 'express';
import { add } from '@reaction/controllers/add-reactions';
import HTTP_STATUS from 'http-status-codes';
import { CustomError } from '@global/helpers/error-handler';

jest.useFakeTimers();
jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/reaction.cache');

describe('AddReaction', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should send correct json response and call cache/queue with correct data', async () => {
    const req: Request = reactionMockRequest({}, addReactionBody, authUserPayload) as Request;
    const res: Response = reactionMockResponse();

    const cacheSpy = jest.spyOn(ReactionCache.prototype, 'savePostReactionToCache');
    const queueSpy = jest.spyOn(reactionQueue, 'addReactionJob');

    await add.reaction(req, res);

    const cacheCallArgs = cacheSpy.mock.calls[0];
    const reactionObjectArg = cacheCallArgs[1];

    expect(cacheSpy).toHaveBeenCalledWith(
      addReactionBody.postId,
      reactionObjectArg,
      addReactionBody.postReactions,
      addReactionBody.type,
      addReactionBody.previousReaction
    );

    expect(reactionObjectArg).toEqual(
      expect.objectContaining({
        username: authUserPayload.username,
        avataColor: authUserPayload.avatarColor,
        type: addReactionBody.type,
        postId: addReactionBody.postId
      })
    );

    const queueCallArgs = queueSpy.mock.calls[0];
    const dbReactionData = queueCallArgs[1];
    expect(queueSpy).toHaveBeenCalledWith('addReactionToDB', dbReactionData);

    expect(dbReactionData).toEqual(
      expect.objectContaining({
        username: authUserPayload.username,
        userFrom: authUserPayload.userId
      })
    );

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Reaction added successfully'
    });
  });

  it('should throw an error if postId is missing', async () => {
    const invalidBody = { ...addReactionBody, postId: undefined };
    const req: Request = reactionMockRequest({}, invalidBody, authUserPayload) as Request;
    const res: Response = reactionMockResponse();

    await add.reaction(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('postId is a required property');
    });
  });
});
