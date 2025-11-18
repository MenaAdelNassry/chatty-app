import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from "express";
import { get } from "@post/controllers/get-posts";
import { generateMockPosts, newPost, postMockData, postMockRequest, postMockResponse } from "@root/mocks/post.mock";
import { authUserPayload } from "@root/mocks/auth.mock";
import { PostCache } from "@service/redis/post.cache";
import { postService } from "@service/db/post.service";

jest.mock("@service/redis/post.cache.ts");
jest.mock("@service/db/post.service.ts");

describe("Get", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe("posts", () => {
    it("should send correct json response if posts exist in cache", async () => {
      const req: Request = postMockRequest(newPost, authUserPayload, { page: '2' }) as Request;
      const res: Response = postMockResponse();
      const posts = generateMockPosts(postMockData, 11);

      jest.spyOn(PostCache.prototype, 'getPostsFromCache').mockResolvedValue([posts[10]]);
      jest.spyOn(PostCache.prototype, 'getTotalPostsInCache').mockResolvedValue(11);
      const dbSpy = jest.spyOn(postService, 'getPosts');

      await get.posts(req, res);

      expect(PostCache.prototype.getPostsFromCache).toHaveBeenCalledWith('post', 10, 19);
      expect(dbSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'All posts', posts: [posts[10]], totalPosts: 11 });
    });

    it('should send correct json response if posts exist in database', async () => {
      const req: Request = postMockRequest(newPost, authUserPayload, { page: '1' }) as Request;
      const res: Response = postMockResponse();

      const posts = [postMockData];
      jest.spyOn(PostCache.prototype, 'getPostsFromCache').mockResolvedValue([]);
      jest.spyOn(postService, 'getPosts').mockResolvedValue(posts);
      jest.spyOn(postService, 'getPostsCount').mockResolvedValue(1);

      await get.posts(req, res);

      expect(PostCache.prototype.getPostsFromCache).toHaveBeenCalled();
      expect(postService.getPosts).toHaveBeenCalled();
      expect(postService.getPosts).toHaveBeenCalledWith({}, 0, 10, { createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'All posts', posts, totalPosts: 1 });
    });

    it("should send empty posts", async () => {
      const req: Request = postMockRequest(newPost, authUserPayload, { page: '1' }) as Request;
      const res: Response = postMockResponse();
      jest.spyOn(PostCache.prototype, 'getPostsFromCache').mockResolvedValue([]);
      jest.spyOn(PostCache.prototype, 'getTotalPostsInCache').mockResolvedValue(0);
      jest.spyOn(postService, 'getPosts').mockResolvedValue([]);
      jest.spyOn(postService, 'getPostsCount').mockResolvedValue(0);

      await get.posts(req, res);
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All posts',
        posts: [],
        totalPosts: 0
      });
    });
  });

  describe("postWithImages", () => {
    it("should send correct json response if posts exist in cache", async () => {
      const req: Request = postMockRequest(newPost, authUserPayload, { page: '1' }) as Request;
      const res: Response = postMockResponse();
      const posts = [postMockData];

      jest.spyOn(PostCache.prototype, 'getPostsWithImagesFromCache').mockResolvedValue(posts);

      await get.postsWithImages(req, res);

      expect(PostCache.prototype.getPostsWithImagesFromCache).toHaveBeenCalledWith('post', 0, 9);
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All posts with images',
        posts,
      });
    });

    it("should send correct json response if posts exist in database", async () => {
      const req: Request = postMockRequest(newPost, authUserPayload, { page: '1' }) as Request;
      const res: Response = postMockResponse();
      const posts = [postMockData];

      jest.spyOn(PostCache.prototype, 'getPostsWithImagesFromCache').mockResolvedValue([]);
      jest.spyOn(postService, 'getPosts').mockResolvedValue(posts);

      await get.postsWithImages(req, res);

      expect(postService.getPosts).toHaveBeenCalledWith({ imgId: { $ne: '' }, gifUrl: { $ne: '' } }, 0, 10, { createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All posts with images',
        posts,
      });
    });

    it('should send empty posts', async () => {
      const req: Request = postMockRequest(newPost, authUserPayload, { page: '1' }) as Request;
      const res: Response = postMockResponse();

      jest.spyOn(PostCache.prototype, 'getPostsWithImagesFromCache').mockResolvedValue([]);
      jest.spyOn(postService, 'getPosts').mockResolvedValue([]);

      await get.postsWithImages(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'All posts with images',
        posts: []
      });
    });
  });
});
