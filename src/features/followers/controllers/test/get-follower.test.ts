import { authUserPayload } from "@root/mocks/auth.mock";
import { followersMockRequest, followersMockResponse, mockFollowerData } from "@root/mocks/follower.mock";
import { followerService } from "@service/db/follower.service";
import { FollowerCache } from "@service/redis/follower.cache";
import { Request, Response } from "express";
import { get } from '@follower/controllers/get-followers';
import HTTP_STATUS from 'http-status-codes';
import mongoose from "mongoose";

jest.mock('@service/redis/follower.cache');
jest.mock('@service/db/follower.service');

describe('Get', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('userFollowing', () => {
    it('should return following list from CACHE if available', async () => {
      const req: Request = followersMockRequest({}, authUserPayload) as Request;
      const res: Response = followersMockResponse();

      jest.spyOn(FollowerCache.prototype, 'getFollowersFromCache').mockResolvedValue([mockFollowerData]);
      const dbSpy = jest.spyOn(followerService,'getUserFollowing');

      await get.userFollowing(req, res);

      expect(FollowerCache.prototype.getFollowersFromCache).toHaveBeenCalledWith(`following:${req.currentUser!.userId}`);
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User following',
        following: [mockFollowerData]
      });
    });

    it("should return following list from DB if cache is empty", async () => {
      const req: Request = followersMockRequest({}, authUserPayload) as Request;
      const res: Response = followersMockResponse();

      jest.spyOn(FollowerCache.prototype, 'getFollowersFromCache').mockResolvedValue([]);
      jest.spyOn(followerService, 'getUserFollowing').mockResolvedValue([mockFollowerData]);

      await get.userFollowing(req, res);

      expect(followerService.getUserFollowing).toHaveBeenCalledWith(expect.any(mongoose.Types.ObjectId));
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User following',
        following: [mockFollowerData]
      });
    });
  });

  describe('userFollowers', () => {
    it("should return followers list from CACHE if available", async () => {
      const req: Request = followersMockRequest({}, authUserPayload) as Request;
      const res: Response = followersMockResponse();

      jest.spyOn(FollowerCache.prototype, 'getFollowersFromCache').mockResolvedValue([mockFollowerData]);
      const dbSpy = jest.spyOn(followerService, 'getUserFollowers');

      await get.userFollowers(req, res);

      expect(FollowerCache.prototype.getFollowersFromCache).toHaveBeenCalledWith(`followers:${req.currentUser!.userId}`);
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User followers',
        followers: [mockFollowerData]
      });
    });

    it("should return followers list from DB if cache is empty", async () => {
      const req: Request = followersMockRequest({}, authUserPayload) as Request;
      const res: Response = followersMockResponse();

      jest.spyOn(FollowerCache.prototype, 'getFollowersFromCache').mockResolvedValue([]);
      jest.spyOn(followerService, 'getUserFollowers').mockResolvedValue([mockFollowerData]);

      await get.userFollowers(req, res);

      expect(followerService.getUserFollowers).toHaveBeenCalledWith(expect.any(mongoose.Types.ObjectId));
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User followers',
        followers: [mockFollowerData]
      });
    });
  });
});
