import { IGetPostsQuery, IPostDocument, IQueryComplete, IQueryDeleted } from "@post/interfaces/post.interface";
import { PostModel } from "@post/models/post.schema";
import { IUserDocument } from "@user/interfaces/user.interface";
import { UserModel } from "@user/models/user.schema";
import { Query, UpdateQuery } from "mongoose";

class PostService {
  public async addPostToDB(userId: string, createdPost: IPostDocument): Promise<void> {
    const post: Promise<IPostDocument> = PostModel.create(createdPost);
    const user: UpdateQuery<IUserDocument> = UserModel.updateOne({ _id: userId }, { $inc: { postsCount: 1 } });
    await Promise.all([ post, user ]);
  }

  public async getPosts(query: IGetPostsQuery, skip=0, limit=0, sort: Record<string, 1 | -1>): Promise<IPostDocument[]> {
    let postQuery = {};

    // Note: we put a flag between backend and frontend
    // if gifUrl and imgId in query is true ==> we send only posts with image (and with pagination)
    if(query?.gifUrl && query?.imgId) {
      postQuery = { $or: [
        { imgId: query.imgId },
        { gifUrl: query.gifUrl },
      ]};
    } else {
      postQuery = query;
    }

    const posts: IPostDocument[] = await PostModel.aggregate([
      { $match: postQuery },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit }
    ]);
    return posts;
  }

  public async getPostsCount(): Promise<number> {
    const count: number = await PostModel.find({}).countDocuments();
    return count
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
}

export const postService: PostService = new PostService();
