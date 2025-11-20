import { Request, Response } from 'express';
import { authUserPayload } from '@root/mocks/auth.mock';
import { reactionMockRequest, reactionMockResponse } from '@root/mocks/reactions.mock';
import { reactionQueue } from '@service/queues/reaction.queue';
import { ReactionCache } from '@service/redis/reaction.cache';
import { remove } from '@reaction/controllers/remove-reaction';
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/reaction.cache');

describe('RemoveReaction', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should send correct json response and call queue with correct data', async () => {
    const postReactions = { like: 5, love: 2, happy: 0, sad: 0, angry: 0, wow: 0 };
    const postId = '6027f77087c9d9ccb1555268';
    const previousReactionType = 'like';

    const req: Request = reactionMockRequest(
      {},
      { postReactions }, // Body
      authUserPayload,   // Current User
      { postId }         // Params
    ) as Request;
    const res: Response = reactionMockResponse();

    const cacheSpy = jest.spyOn(ReactionCache.prototype, 'removePostReactionFromCache').mockResolvedValue({
      type: previousReactionType
    } as any);

    const queueSpy = jest.spyOn(reactionQueue, 'addReactionJob');

    await remove.reaction(req, res);

    expect(cacheSpy).toHaveBeenCalledWith(
      postId,
      authUserPayload.username,
      postReactions
    );

    expect(queueSpy).toHaveBeenCalledWith('removeReactionFromDB', {
      postId,
      username: authUserPayload.username,
      previousReaction: previousReactionType
    });

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Reaction removed from post'
    });
  });
});
