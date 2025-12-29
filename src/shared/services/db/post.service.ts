import { IGetPostsQuery, IPostDocument, IQueryComplete, IQueryDeleted } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import mongoose, { Query, UpdateQuery } from 'mongoose';

class PostService {
  public async addPostToDB(userId: string, createdPost: IPostDocument): Promise<void> {
    const post: Promise<IPostDocument> = PostModel.create(createdPost);
    const user: UpdateQuery<IUserDocument> = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: 1 } });
    await Promise.all([post, user]);
  }

  public async getPosts(query: IGetPostsQuery, skip = 0, limit = 0, sort: Record<string, 1 | -1>): Promise<IPostDocument[]> {
    let postQuery = {};

    if (query?.gifUrl && query?.imgId) {
      postQuery = { $or: [{ imgId: { $ne: '' } }, { gifUrl: { $ne: '' } }] };
    } else if (query?.videoId) {
      postQuery = { videoId: { $ne: '' } };
    } else {
      postQuery = query;
    }

    const posts: IPostDocument[] = await PostModel.aggregate([{ $match: postQuery }, { $sort: sort }, { $skip: skip }, { $limit: limit }]);
    return posts;
  }

  public async getPostsCount(query: IGetPostsQuery): Promise<number> {
    let postQuery = {};

    if (query?.gifUrl && query?.imgId) {
      postQuery = { $or: [{ imgId: { $ne: '' } }, { gifUrl: { $ne: '' } }] };
    } else if (query?.videoId) {
      postQuery = { videoId: { $ne: '' } };
    } else {
      postQuery = query;
    }

    const count: number = await PostModel.find(postQuery).countDocuments();
    return count;
  }

  public async deletePost(postId: string, userId: string): Promise<void> {
    const deletedPost: Query<IQueryComplete & IQueryDeleted, IPostDocument> = PostModel.deleteOne({ _id: postId });
    // delete reactions here
    const decrementedUserPostCount: UpdateQuery<IUserDocument> = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: -1 } });
    await Promise.all([deletedPost, decrementedUserPostCount]);
  }

  public async editPost(postId: string, updatedPost: IPostDocument): Promise<void> {
    await PostModel.updateOne({ _id: postId }, { $set: updatedPost });
  }

  public async getOnePost(postId: string): Promise<IPostDocument | null> {
    const post = await PostModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(postId) } },
      { $lookup: { from: "User", localField: "userId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $lookup: { from: "Auth", localField: "user.authId", foreignField: "_id", as: "authId" } },
      { $unwind: "$authId" },
      {
        $project: {
          _id: 1,
          post: 1,
          commentsCount: 1,
          imgId: 1,
          imgVersion: 1,
          gifUrl: 1,
          feelings: 1,
          privacy: 1,
          videoId: 1,
          createdAt: 1,
          reactions: 1,
          videoVersion: 1,
          bgColor: 1,
          username: '$authId.username',
          email: '$authId.email',
          avatarColor: '$authId.avatarColor',
          uId: '$authId.uId',
          profilePicture: '$user.profilePicture',
        }
      }
    ]);

    return post.length > 0 ? post[0] : null;
  }
}

export const postService: PostService = new PostService();
