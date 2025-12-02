import { Request, Response } from 'express';
import { authUserPayload, authMockRequest, authMockResponse } from '@root/mocks/auth.mock';
import { existingUser, existingUserTwo } from '@root/mocks/user.mock';
import { mockFollowerData } from '@root/mocks/follower.mock';
import { postMockData } from '@root/mocks/post.mock';
import { UserCache } from '@service/redis/user.cache';
import { FollowerCache } from '@service/redis/follower.cache';
import { PostCache } from '@service/redis/post.cache';
import { userService } from '@service/db/user.service';
import { followerService } from '@service/db/follower.service';
import { postService } from '@service/db/post.service';
import { get } from '@user/controllers/get-profile';
import { BadRequestError } from '@global/helpers/error-handler';
import HTTP_STATUS from 'http-status-codes';

// 1. Mocking Services & Caches
jest.mock('@service/redis/user.cache');
jest.mock('@service/redis/follower.cache');
jest.mock('@service/redis/post.cache');
jest.mock('@service/db/user.service');
jest.mock('@service/db/follower.service');
jest.mock('@service/db/post.service');

describe('Get User Profile Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // 1. Test: users (Get All Users)
  // ========================================================================
  describe('users', () => {
    it('should send correct json response with users from CACHE', async () => {
      // Arrange
      const req: Request = authMockRequest({}, {}, authUserPayload, { page: '1' }) as Request;
      const res: Response = authMockResponse();

      // Spies
      jest.spyOn(UserCache.prototype, 'getUsersFromCache').mockResolvedValue([existingUser]);
      jest.spyOn(UserCache.prototype, 'countUsersInCache').mockResolvedValue(1);
      jest.spyOn(FollowerCache.prototype, 'getFollowersFromCache').mockResolvedValue([mockFollowerData]);
      const dbSpy = jest.spyOn(userService, 'getAllUsers');

      // Act
      await get.users(req, res);

      // Assert
      expect(UserCache.prototype.getUsersFromCache).toHaveBeenCalledWith(0, 9, authUserPayload.userId); // skip=0, limit=10 -> end=9
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Get users',
        users: [existingUser],
        totalUsers: 1,
        followers: [mockFollowerData]
      });
    });

    it('should send correct json response with users from DB if cache empty', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload, { page: '1' }) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(UserCache.prototype, 'getUsersFromCache').mockResolvedValue([]);
      jest.spyOn(FollowerCache.prototype, 'getFollowersFromCache').mockResolvedValue([]);

      jest.spyOn(userService, 'getAllUsers').mockResolvedValue([existingUser]);
      jest.spyOn(userService, 'countUsersInDB').mockResolvedValue(1);
      jest.spyOn(followerService, 'getUserFollowers').mockResolvedValue([mockFollowerData]);

      await get.users(req, res);

      expect(userService.getAllUsers).toHaveBeenCalledWith(authUserPayload.userId, 0, 10);
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ users: [existingUser] }));
    });
  });

  // ========================================================================
  // 2. Test: userProfileById (Single User)
  // ========================================================================
  describe('userProfileById', () => {
    it('should return user profile from CACHE', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload, { userId: existingUser._id }) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(UserCache.prototype, 'getUserFromCache').mockResolvedValue(existingUser);
      const dbSpy = jest.spyOn(userService, 'getUserById');

      await get.userProfileById(req, res);

      expect(UserCache.prototype.getUserFromCache).toHaveBeenCalledWith(existingUser._id);
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Get user profile by id',
        user: existingUser
      });
    });

    it('should return user profile from DB if cache miss', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload, { userId: existingUser._id }) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(UserCache.prototype, 'getUserFromCache').mockResolvedValue(null);
      jest.spyOn(userService, 'getUserById').mockResolvedValue(existingUser);

      await get.userProfileById(req, res);

      expect(userService.getUserById).toHaveBeenCalledWith(existingUser._id);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Get user profile by id',
        user: existingUser
      });
    });

    it('should throw BadRequestError if user not found anywhere', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload, { userId: 'invalid-id' }) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(UserCache.prototype, 'getUserFromCache').mockResolvedValue(null);
      jest.spyOn(userService, 'getUserById').mockResolvedValue(null as any);

      await get.userProfileById(req, res).catch((error: BadRequestError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.message).toEqual('User not found');
      });
    });
  });

  // ========================================================================
  // 3. Test: userPostsById (Profile Posts)
  // ========================================================================
  describe('userPostsById', () => {
    it('should return posts from CACHE (My Profile)', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload, { userId: authUserPayload.userId, page: '1' }) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(PostCache.prototype, 'getUserPostsFromCache').mockResolvedValue([postMockData]);
      const dbSpy = jest.spyOn(postService, 'getPosts');

      await get.userPostsById(req, res);

      expect(PostCache.prototype.getUserPostsFromCache).toHaveBeenCalledWith(
        'post',
        parseInt(authUserPayload.uId, 10),
        0,
        10
      );
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Get user posts by id',
        posts: [postMockData]
      });
    });

    it('should return posts from DB if cache empty', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload, { userId: '60263f14648fed5246e322d4', page: '1' }) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(UserCache.prototype, 'getUserFromCache').mockResolvedValue(null);
      jest.spyOn(postService, 'getPosts').mockResolvedValue([postMockData]);

      await get.userPostsById(req, res);

      expect(postService.getPosts).toHaveBeenCalledWith(
        { userId: existingUser._id },
        0,
        10,
        { createdAt: -1 }
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'Get user posts by id',
        posts: [postMockData]
      });
    });
  });

  // ========================================================================
  // 4. Test: randomUserSuggestions
  // ========================================================================
  describe('randomUserSuggestions', () => {
    it('should return suggestions from CACHE', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(UserCache.prototype, 'getRandomUsersFromCache').mockResolvedValue([existingUserTwo]);
      const dbSpy = jest.spyOn(userService, 'getRandomUsersFromDB');

      await get.randomUserSuggestions(req, res);

      expect(UserCache.prototype.getRandomUsersFromCache).toHaveBeenCalledWith(authUserPayload.userId);
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'User suggestions',
        users: [existingUserTwo]
      });
    });

    it('should return suggestions from DB if cache returns empty list', async () => {
      const req: Request = authMockRequest({}, {}, authUserPayload) as Request;
      const res: Response = authMockResponse();

      jest.spyOn(UserCache.prototype, 'getRandomUsersFromCache').mockResolvedValue([]);
      jest.spyOn(userService, 'getRandomUsersFromDB').mockResolvedValue([existingUserTwo]);

      await get.randomUserSuggestions(req, res);

      expect(userService.getRandomUsersFromDB).toHaveBeenCalledWith(authUserPayload.userId);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User suggestions',
        users: [existingUserTwo]
      });
    });
  });
});
