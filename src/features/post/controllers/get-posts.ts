import HTTP_STATUS from 'http-status-codes';
import { IPostDocument } from "@post/interfaces/post.interface";
import { postService } from "@service/db/post.service";
import { PostCache } from "@service/redis/post.cache";
import { Request, Response } from "express";

const postCache: PostCache = new PostCache();
const PAGE_SIZE = 10;

class Get {
  public postById = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const post = await postService.getOnePost(postId);

    if (!post) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
      return;
    }

    res.status(HTTP_STATUS.OK).json({ post });
  }

  public posts = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts, totalPosts } = await this.getPostsFromCacheOrDB(page, 'all');

    res.status(HTTP_STATUS.OK).json({ message: 'All posts', posts, totalPosts });
  }

  public postsWithImages = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts } = await this.getPostsFromCacheOrDB(page, 'image');

    res.status(HTTP_STATUS.OK).json({ message: 'All posts with images', posts });
  }

  public postsWithVideos = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts } = await this.getPostsFromCacheOrDB(page, 'video');

    res.status(HTTP_STATUS.OK).json({ message: 'All posts with videos', posts });
  }

  private getPostsFromCacheOrDB = async (
    page: string,
    type: 'all' | 'image' | 'video',
  ): Promise<{ posts: IPostDocument[]; totalPosts: number }> => {
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE;
    const start: number = skip;
    const end: number = skip + PAGE_SIZE - 1;

    let posts: IPostDocument[] = [];
    let totalPosts = 0;

    let cacheMethod: 'getPostsFromCache' | 'getPostsWithImagesFromCache' | 'getPostsWithVideosFromCache';
    let dbQuery: object;

    if(type === 'image') {
      cacheMethod = 'getPostsWithImagesFromCache';
      dbQuery = { imgId: true, gifUrl: true };
    } else if(type === 'video') {
      cacheMethod = 'getPostsWithVideosFromCache';
      dbQuery = { videoId: true }
    } else {
      cacheMethod = 'getPostsFromCache';
      dbQuery = {};
    }

    const cachedPosts: IPostDocument[] = await postCache[cacheMethod]('post', start, end);

    if(cachedPosts.length) {
      posts = cachedPosts;

      if (type === 'all') {
        totalPosts = await postCache.getTotalPostsInCache();
      } else {
        totalPosts = await postService.getPostsCount(dbQuery);
      }
    } else {
      posts = await postService.getPosts(dbQuery, skip, limit, { createdAt: -1 });
      totalPosts = await postService.getPostsCount(dbQuery);
    }

    return { posts, totalPosts };
  }
}

export const get: Get = new Get();
