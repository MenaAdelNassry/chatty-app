import HTTP_STATUS from 'http-status-codes';
import { IGetPostsQuery, IPostDocument } from '@post/interfaces/post.interface';
import { postService } from '@service/db/post.service';
import { PostCache } from '@service/redis/post.cache';
import { Request, Response } from 'express';
import { ReactionCache } from '@service/redis/reaction.cache';

const postCache: PostCache = new PostCache();
const reactionCache: ReactionCache = new ReactionCache();
const PAGE_SIZE = 10;

class Get {
  public postById = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const userId = req.currentUser!.userId;

    // 1. Try fetching from Cache
    let post = await postCache.getPostFromCache(postId, userId);

    // 2. Cache Miss Strategy (Lazy Loading)
    if (!post) {
      post = await postService.getOnePost(postId, userId);

      // If found in DB, save it to Cache for next time
      if (post) {
        await postCache.savePostsToCache([post], userId);
      }
    }

    // 3. Validation: Post Exists?
    if (!post) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Post not found' });
      return;
    }

    const postsWithReactions = await this.addReactionsToPosts([post], userId);

    // 4. Success
    res.status(HTTP_STATUS.OK).json({ post: postsWithReactions[0] });
  };

  public postsByUserId = async (req: Request, res: Response): Promise<void> => {
    const { userId, page } = req.params;
    const myId = req.currentUser!.userId;
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE;

    // 1. Try Cache ⚡
    const cachedPosts: IPostDocument[] = await postCache.getUserPostsFromCache(
      `post:${userId}`,
      skip,
      limit,
      userId,
      userId.toString() !== myId.toString() ? myId : undefined
    );

    if (cachedPosts.length > 0) {
      res.status(HTTP_STATUS.OK).json({ message: 'User posts', posts: cachedPosts });
      return;
    }

    // 2. Fallback to DB 💾
    let posts = await postService.getPosts(
      { userId },
      skip,
      limit,
      { createdAt: -1 },
      myId.toString()
    );

    // ✅ 3. Cache Repair
    if(posts.length > 0) {
      await postCache.savePostsToCache(posts, myId);
    }

    posts = await this.addReactionsToPosts(posts, myId);

    res.status(HTTP_STATUS.OK).json({ message: 'User posts', posts });
  };

  public posts = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts, totalPosts } = await this.getPostsFromCacheOrDB(page, 'all', req.currentUser!.userId);

    res.status(HTTP_STATUS.OK).json({ message: 'All posts', posts, totalPosts });
  };

  public postsWithImages = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts, totalPosts } = await this.getPostsFromCacheOrDB(page, 'image', req.currentUser!.userId);

    res.status(HTTP_STATUS.OK).json({ message: 'All posts with images', posts, totalPosts });
  };

  public postsWithVideos = async (req: Request, res: Response): Promise<void> => {
    const { page } = req.params;
    const { posts, totalPosts } = await this.getPostsFromCacheOrDB(page, 'video', req.currentUser!.userId);

    res.status(HTTP_STATUS.OK).json({ message: 'All posts with videos', posts, totalPosts });
  };

  private getPostsFromCacheOrDB = async (
    page: string,
    type: 'all' | 'image' | 'video',
    userId: string
  ): Promise<{ posts: IPostDocument[]; totalPosts: number }> => {
    const skip: number = (parseInt(page) - 1) * PAGE_SIZE;
    const limit: number = PAGE_SIZE;
    const start: number = skip;
    const end: number = skip + PAGE_SIZE - 1;

    let posts: IPostDocument[] = [];
    let totalPosts = 0;

    const publicPrivacyQuery = { privacy: { $regex: /^public$/i } };

    if (type === 'all') {
      // 1. Try fetching from Redis Cache first for "All Posts"
      const cachedPosts: IPostDocument[] = await postCache.getPostsFromCache('post', start, end, userId);

      if (cachedPosts.length) {
        posts = cachedPosts;
        totalPosts = await postCache.getTotalPostsInCache();
      } else {
        // Redis empty? Fallback to DB
        posts = await postService.getPosts({}, skip, limit, { createdAt: -1 }, userId);
        totalPosts = await postService.getPostsCount(publicPrivacyQuery);
        await postCache.savePostsToCache(posts, userId);
      }
    } else {
      // 2. For Filters (Image/Video), Go directly to DB to ensure correct pagination
      // (Bypassing Redis Filter issue)
      let dbQuery: IGetPostsQuery = type === 'image' ? { imgId: true, gifUrl: true } : { videoId: true };

      posts = await postService.getPosts({ ...dbQuery, ...publicPrivacyQuery }, skip, limit, { createdAt: -1 }, userId);
      totalPosts = await postService.getPostsCount({ ...dbQuery, ...publicPrivacyQuery });
    }

    posts = await this.addReactionsToPosts(posts, userId);

    return { posts, totalPosts };
  };

  private addReactionsToPosts = async (posts: IPostDocument[], userId: string): Promise<IPostDocument[]> => {
    if(!posts.length) return [];

    const postsWithReactions = await Promise.all(
      posts.map(async (post) => {
        const cachedReaction = await reactionCache.getSingleReactionByUserIdFromCache(post._id as string, userId);
        const reactionType = cachedReaction.length ? cachedReaction[0].type : undefined;

        post.currentUserReaction = reactionType;
        return post;
      })
    );

    return postsWithReactions;
  };
}

export const get: Get = new Get();
