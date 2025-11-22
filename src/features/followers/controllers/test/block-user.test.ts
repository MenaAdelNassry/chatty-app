import { Request, Response } from 'express';
import { authUserPayload } from '@root/mocks/auth.mock';
import { followersMockRequest, followersMockResponse } from '@root/mocks/follower.mock';
import { blockedUserQueue } from '@service/queues/blocked.queue';
import { blockUser } from '@follower/controllers/block-user';
import { FollowerCache } from '@service/redis/follower.cache';
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/follower.cache');
jest.mock('@service/queues/blocked.queue');

describe('BlockUser Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('block', () => {
    it('should update cache and add to queue with type "block"', async () => {
      // Arrange
      const blockedUserId = '6027f77087c9d9ccb1555268';
      const req: Request = followersMockRequest(
        {},
        authUserPayload,
        { blockedUserId } // Params
      ) as Request;
      const res: Response = followersMockResponse();

      // Spies
      const cacheSpy = jest.spyOn(FollowerCache.prototype, 'updateBlockedUserPropInCache');
      const queueSpy = jest.spyOn(blockedUserQueue, 'addBlockedUserJob');

      // Act
      await blockUser.block(req, res);

      // Assert
      expect(cacheSpy).toHaveBeenCalledWith(
        `${req.currentUser?.userId}`,
        'blocked',
        blockedUserId,
        'block'
      );
      expect(cacheSpy).toHaveBeenCalledWith(
        blockedUserId,
        'blockedBy',
        `${req.currentUser?.userId}`,
        'block'
      );

      expect(queueSpy).toHaveBeenCalledWith('updateBlockedUserInDB', {
        keyOne: `${req.currentUser?.userId}`,
        keyTwo: blockedUserId,
        type: 'block'
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'User blocked' });
    });
  });

  describe('unblock', () => {
    it('should update cache and add to queue with type "unblock"', async () => {
      // Arrange
      const blockedUserId = '6027f77087c9d9ccb1555268';
      const req: Request = followersMockRequest(
        {},
        authUserPayload,
        { blockedUserId }
      ) as Request;
      const res: Response = followersMockResponse();

      // Spies
      const cacheSpy = jest.spyOn(FollowerCache.prototype, 'updateBlockedUserPropInCache');
      const queueSpy = jest.spyOn(blockedUserQueue, 'addBlockedUserJob');

      // Act
      await blockUser.unblock(req, res);

      // Assert
      expect(cacheSpy).toHaveBeenCalledWith(
        `${req.currentUser?.userId}`,
        'blocked',
        blockedUserId,
        'unblock'
      );
      expect(cacheSpy).toHaveBeenCalledWith(
        blockedUserId,
        'blockedBy',
        `${req.currentUser?.userId}`,
        'unblock'
      );

      expect(queueSpy).toHaveBeenCalledWith('updateBlockedUserInDB', {
        keyOne: `${req.currentUser?.userId}`,
        keyTwo: blockedUserId,
        type: 'unblock'
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'User unblocked' });
    });
  });
});
