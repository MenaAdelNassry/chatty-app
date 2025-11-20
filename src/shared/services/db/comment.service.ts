import { ICommentDocument, ICommentJob, ICommentNameList, IQueryComment, IQuerySort } from '@comment/interfaces/comment.interface';
import { CommentsModel } from '@comment/models/comment.schema';
import { IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { UserCache } from '@service/redis/user.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { Query } from 'mongoose';

const userCache: UserCache = new UserCache();

class CommentService {
  public async addCommentToDB(data: ICommentJob): Promise<void> {
    // -------------------------------------------------------------------------
    // TODO: ⚠️ PERFORMANCE & SAFETY BENCHMARK NEEDED
    // I am currently using `Promise.all` to execute these DB operations in parallel
    // for better performance (concurrency).
    //
    // RISKS TO CHECK LATER:
    // 1. Atomicity: If one fails, Promise.all fails fast. Do we need partial success?
    // 2. Load: Does hitting the DB with parallel writes cause locking issues?
    //
    // ACTION: Benchmark this against sequential `await` to see if the speed gain
    // is worth the complexity/risk, especially under high load.
    // -------------------------------------------------------------------------
    const { postId, userFrom, userTo, comment, username } = data;

    const commentCreated: Promise<ICommentDocument> = CommentsModel.create(comment);
    const post: Query<IPostDocument, IPostDocument> = PostModel.findOneAndUpdate(
      { _id: postId },
      { $inc: { commentsCount: 1 } },
      { new: true }
    ) as Query<IPostDocument, IPostDocument>;
    const user: Promise<IUserDocument | null> = userCache.getUserFromCache(userTo);

    const response: [ICommentDocument, IPostDocument, IUserDocument | null] = await Promise.all([commentCreated, post, user]);
    // Send notification to user later on (using response[0] and response[2])
  }

  public async getPostComments(query: IQueryComment, sort: Record<string, 1 | -1>): Promise<ICommentDocument[]> {
    const comments: ICommentDocument[] = await CommentsModel.aggregate([{ $match: query }, { $sort: sort }]);
    return comments;
  }

  public async getPostCommentNames(query: IQueryComment): Promise<ICommentNameList> {
    const commentsNamesList: ICommentNameList[] = await CommentsModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          names: { $addToSet: '$username' },
          count: { $sum: 1 },
        }
      },
      { $project: { _id: 0 } }
    ]);

    if(commentsNamesList.length > 0) {
      return commentsNamesList[0];
    }

    return { names: [], count: 0 };
  }
}

export const commentService: CommentService = new CommentService();
