import { Request, Response } from 'express';
import { Server } from 'socket.io';
import * as followerServer from '@socket/follower';
import { followersMockRequest, followersMockResponse } from '@root/mocks/follower.mock';
import { authUserPayload } from '@root/mocks/auth.mock';
import { existingUserTwo } from '@root/mocks/user.mock';
import { followerQueue } from '@service/queues/follower.queue';
import { FollowerCache } from '@service/redis/follower.cache';
import { remove } from '@follower/controllers/unfollow-user';
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/follower.cache');

describe('Remove Follower Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should send correct json response and call cache/queue with correct IDs', async () => {
    const followeeId = `${existingUserTwo._id}`;
    const followerId = `${authUserPayload.userId}`;

    const req: Request = followersMockRequest(
      {},
      authUserPayload,
      { followeeId }
    ) as Request;
    const res: Response = followersMockResponse();

    const removeSpy = jest.spyOn(FollowerCache.prototype, 'removeFollowerFromCache');
    const countSpy = jest.spyOn(FollowerCache.prototype, 'updateFollowersCountInCache');
    const queueSpy = jest.spyOn(followerQueue, 'addFollowerJob');

    await remove.follower(req, res);

    expect(removeSpy).toHaveBeenCalledWith(`followers:${followeeId}`, followerId);
    expect(removeSpy).toHaveBeenCalledWith(`following:${followerId}`, followeeId);

    expect(countSpy).toHaveBeenCalledWith(followeeId, 'followersCount', -1);
    expect(countSpy).toHaveBeenCalledWith(followerId, 'followingCount', -1);

    expect(queueSpy).toHaveBeenCalledWith('removeFollowerFromDB', {
      keyOne: followeeId,
      keyTwo: followerId
    });

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unfollowed user now' });
  });
});
