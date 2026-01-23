import { ICommentDocument, ICommentJob, ICommentNameList, IQueryComment } from '@comment/interfaces/comment.interface';
import { CommentsModel } from '@comment/models/comment.schema';
import { IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { UserCache } from '@service/redis/user.cache';
import { userService } from '@service/db/user.service';
import { IUserDocument } from '@user/interfaces/user.interface';
import mongoose, { Query } from 'mongoose';
import { notificationQueue } from '@service/queues/notification.queue';

const userCache: UserCache = new UserCache();

class CommentService {
  public async addCommentToDB(data: ICommentJob): Promise<void> {
    const { postId, userFrom, comment, username } = data;

    // 1. Create Comment & Update Post (Parallel) ⚡
    const commentCreatedPromise = CommentsModel.create(comment);
    const postUpdatedPromise = PostModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(postId) },
      { $inc: { commentsCount: 1 } },
      { new: true }
    ) as Query<IPostDocument, IPostDocument>;

    const [commentDocument, postDocument] = await Promise.all([commentCreatedPromise, postUpdatedPromise]);

    // 🛡️ Security Check
    if (!postDocument) return;

    // 2. Optimization: Stop if self-comment (Early Exit) 🛑
    const userToId = postDocument.userId.toString();
    if (userFrom === userToId) return;

    // 3. Get User Data (Cache -> Fallback DB) 🔄
    let userToData: IUserDocument | null = await userCache.getUserFromCache(userToId);

    if (!userToData) {
      userToData = await userService.getUserById(userToId);
      // ✅ Hydration
      if (userToData) {
        await userCache.saveUserToCache(userToId, userToData.uId!, userToData);
      }
    }

    // 4. Send Notification Logic 🔔
    notificationQueue.addNotificationJob('insertNotification', {
      userFrom,
      userTo: userToId,
      message: `${username} commented on your post.`,
      notificationType: 'comments',
      entityId: postId,
      createdItemId: `${commentDocument._id}`,
      createdAt: new Date(),
      comment: comment.comment,
      post: postDocument.post,
      imgId: postDocument.imgId,
      imgVersion: postDocument.imgVersion,
      gifUrl: postDocument.gifUrl
    });
  }

  public async getPostComments(query: IQueryComment, sort: Record<string, 1 | -1>): Promise<ICommentDocument[]> {
    const comments: ICommentDocument[] = await CommentsModel.find(query).sort(sort);
    return comments;
  }

  public async deleteCommentFromDB(commentId: string, postId: string): Promise<void> {
    await Promise.all([CommentsModel.deleteOne({ _id: commentId }), PostModel.updateOne({ _id: postId }, { $inc: { commentsCount: -1 } })]);
  }
}

export const commentService: CommentService = new CommentService();
