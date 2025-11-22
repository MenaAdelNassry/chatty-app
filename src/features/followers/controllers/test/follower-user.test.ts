import { Server } from "socket.io";
import * as followerServer from "@socket/follower";
import { Request, Response } from "express";
import { followersMockRequest, followersMockResponse } from "@root/mocks/follower.mock";
import { authUserPayload } from "@root/mocks/auth.mock";
import { existingUser, existingUserTwo } from "@root/mocks/user.mock";
import { FollowerCache } from "@service/redis/follower.cache";
import { UserCache } from "@service/redis/user.cache";
import { followerQueue } from "@service/queues/follower.queue";
import { add } from "@follower/controllers/follower-user";
import HTTP_STATUS from 'http-status-codes';
import mongoose from "mongoose";

jest.mock('@service/queues/base.queue');
jest.mock('@service/redis/user.cache');
jest.mock('@service/redis/follower.cache');

Object.defineProperties(followerServer, {
  socketIOFollowerObject: {
    value: new Server(),
    writable: true
  }
});

describe('Add Follower Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });
  it("should call updateFollowersCountInCache, userCache, saveFollowerToCache and followerQueue", async () => {
    const req: Request = followersMockRequest({}, authUserPayload, { followeeId: `${existingUserTwo._id}` }) as Request;
    const res: Response = followersMockResponse();

    const followerCountSpy = jest.spyOn(FollowerCache.prototype, 'updateFollowersCountInCache');
    const followerCacheSpy = jest.spyOn(FollowerCache.prototype, 'saveFollowerToCache');
    jest.spyOn(UserCache.prototype, 'getUserFromCache')
      .mockResolvedValueOnce(existingUserTwo)
      .mockResolvedValueOnce(existingUser);

    const socketSpy = jest.spyOn(followerServer.socketIOFollowerObject, 'emit');
    const queueSpy = jest.spyOn(followerQueue, 'addFollowerJob');

    await add.follower(req, res);

    expect(followerCountSpy).toHaveBeenCalledTimes(2);
    expect(followerCountSpy).toHaveBeenCalledWith(`${existingUserTwo._id}`, "followersCount", 1);
    expect(followerCountSpy).toHaveBeenCalledWith(`${existingUser._id}`, "followingCount", 1);

    expect(socketSpy).toHaveBeenCalledWith('add follower', expect.objectContaining({
      username: existingUser.username,
      uId: existingUser.uId,
      _id: expect.any(mongoose.Types.ObjectId)
    }));

    expect(followerCacheSpy).toHaveBeenCalledTimes(2);
    expect(followerCacheSpy).toHaveBeenCalledWith(`following:${existingUser._id}`, existingUserTwo._id);
    expect(followerCacheSpy).toHaveBeenCalledWith(`followers:${existingUserTwo._id}`, existingUser._id);

    expect(queueSpy).toHaveBeenCalledWith('addFollowerToDB', {
      keyOne: `${existingUser._id}`,
      keyTwo: `${existingUserTwo._id}`,
      username: authUserPayload.username,
      followerDocumentId: expect.any(Object)
    });

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({ message: 'Following user now' });
  });
})
