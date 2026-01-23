import { CommentsModel } from '@comment/models/comment.schema';
import { BlockModel } from '@follower/models/block.model';
import { NotFoundError } from '@global/helpers/error-handler';
import { ImageModel } from '@image/models/image.schema';
import { IGetPostsQuery, IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { ReactionModel } from '@reaction/models/reaction.schema';
import { FollowerCache } from '@service/redis/follower.cache';
import { PostCache } from '@service/redis/post.cache';
import { UserModel } from '@user/models/user.schema';

const postCache: PostCache = new PostCache();
const followerCache: FollowerCache = new FollowerCache();

class PostService {
  public async addPostToDB(userId: string, createdPost: IPostDocument): Promise<void> {
    const post: Promise<IPostDocument> = PostModel.create(createdPost);
    const user = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: 1 } });
    await Promise.all([post, user]);
  }

  public async getPosts(
    query: IGetPostsQuery,
    skip = 0,
    limit = 0,
    sort: Record<string, 1 | -1>,
    requestUserId: string
  ): Promise<IPostDocument[]> {
    let postQuery = this.getQuery(query);
    let posts: IPostDocument[] = await PostModel.find(postQuery).sort(sort).skip(skip).limit(limit);
    if (!posts.length) return [];

    const results: (IPostDocument | null)[] = await Promise.all(
      posts.map(async (post) => {
        if (requestUserId && post.userId !== requestUserId && post.privacy?.toLowerCase() === 'private') {
          return null;
        }

        const isBlocked = await this.isAnyBlockingBetweenUsers(post.userId, requestUserId!);
        if (isBlocked) return null;

        return post;
      })
    );

    posts = results.filter(Boolean) as IPostDocument[];
    return posts;
  }

  public async getPostsCount(query: IGetPostsQuery): Promise<number> {
    const postQuery = this.getQuery(query);
    const count: number = await PostModel.find(postQuery).countDocuments();
    return count;
  }

  public async deletePost(postId: string, userId: string): Promise<void> {
    const operations: any[] = [
      PostModel.deleteOne({ _id: postId }),
      ReactionModel.deleteMany({ postId }),
      CommentsModel.deleteMany({ postId }),
      UserModel.updateOne({ _id: userId }, { $inc: { postsCount: -1 } })
    ];

    await Promise.all(operations);
  }

  public async editPost(postId: string, updatedPost: IPostDocument): Promise<void> {
    await PostModel.updateOne({ _id: postId }, { $set: updatedPost });
  }

  public async getOnePost(postId: string, requestUserId: string): Promise<IPostDocument | null> {
    const post = await PostModel.findOne({
      _id: postId,
      $or: [{ privacy: { $ne: 'private' } }, { userId: requestUserId }]
    });

    if (!post) return null;

    if (post.userId.toString() === requestUserId) {
      return post;
    }

    const isBlocked = await this.isAnyBlockingBetweenUsers(post.userId, requestUserId);
    if (isBlocked) return null;

    return post;
  }

  public async getPostAccessDetails(postId: string): Promise<{ userId: string; privacy: string } | null> {
    const post = await PostModel.findById(postId).select('userId privacy');

    if (!post) return null;

    return {
      userId: post.userId.toString(),
      privacy: post.privacy!
    };
  }

  public async checkPostPrivacyAndBlocking(postId: string, userId: string): Promise<void> {
    // 1. Get Info
    let postAccess = await postCache.getPostAccessDetails(postId);
    if (!postAccess) {
      postAccess = await this.getPostAccessDetails(postId);
      if (!postAccess) throw new NotFoundError('Post not found');
    }

    const { userId: postOwnerId, privacy } = postAccess;

    // 2. Block Check
    const isBlocked = await followerCache.isUserBlockedBy(userId, postOwnerId);
    const isOwnerBlocked = await followerCache.isUserBlockedBy(postOwnerId, userId);
    if (isBlocked || isOwnerBlocked) throw new NotFoundError('Post not found');

    // 3. Privacy Check
    if (privacy.toLowerCase() === 'private' && userId !== postOwnerId) {
      throw new NotFoundError('Post not found');
    }
  }

  // ------------------------------------------
  // 🛠️ Private Helper Method
  // ------------------------------------------
  private getQuery(query: IGetPostsQuery): any {
    const postQuery = { ...query };
    delete postQuery.imgId;
    delete postQuery.gifUrl;
    delete postQuery.videoId;

    if (query?.gifUrl && query?.imgId) {
      return {
        ...postQuery,
        $or: [{ imgId: { $ne: '' } }, { gifUrl: { $ne: '' } }]
      };
    } else if (query?.videoId) {
      return {
        ...postQuery,
        videoId: { $ne: '' }
      };
    } else {
      return query;
    }
  }

  private async isAnyBlockingBetweenUsers(firstUserId: string, secondUserId: string): Promise<boolean> {
    const blocked = await BlockModel.findOne({
      $or: [
        { blockedId: firstUserId, blockerId: secondUserId },
        { blockedId: secondUserId, blockerId: firstUserId }
      ]
    });

    return blocked ? true : false;
  }
}

export const postService: PostService = new PostService();
