import HTTP_STATUS from 'http-status-codes';
import { IPostDocument } from "@post/interfaces/post.interface";
import { postService } from "@service/db/post.service";
import { PostCache } from "@service/redis/post.cache";
import { Request, Response } from "express";

const postCache: PostCache = new PostCache();
const PAGE_SIZE = 10;

class Get {
  public posts = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts, totalPosts } = await this.getPostsFromCacheOrDB(page, 'all');

    res.status(HTTP_STATUS.OK).json({ message: 'All posts', posts, totalPosts });
  }

  public postsWithImages = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts } = await this.getPostsFromCacheOrDB(page, 'media');

    res.status(HTTP_STATUS.OK).json({ message: 'All posts with images', posts });
  }

  private getPostsFromCacheOrDB = async (
    page: string,
    type: 'all' | 'media',
  ): Promise<{ posts: IPostDocument[]; totalPosts: number }> => {
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE;
    const start: number = skip;
    const end: number = skip + PAGE_SIZE - 1;

    let posts: IPostDocument[] = [];
    let totalPosts = 0;

    let cacheMethod: 'getPostsFromCache' | 'getPostsWithImagesFromCache';
    let dbQuery: object;

    if(type === 'media') {
      cacheMethod = 'getPostsWithImagesFromCache';
      dbQuery = { imgId: { $ne: '' }, gifUrl: { $ne: '' } }; // may { imgId: true, gifUrl: true }
    } else {
      cacheMethod = 'getPostsFromCache';
      dbQuery = {};
    }

    const cachedPosts: IPostDocument[] = await postCache[cacheMethod]('post', start, end);

    if(cachedPosts.length) {
      posts = cachedPosts;
      if (type === 'all') {
        totalPosts = await postCache.getTotalPostsInCache();
      }
    } else {
      posts = await postService.getPosts(dbQuery, skip, limit, { createdAt: -1 });
      if (type === 'all') {
        totalPosts = await postService.getPostsCount();
      }
    }

    return { posts, totalPosts };
  }
}

export const get: Get = new Get();
