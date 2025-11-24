import { ICommentDocument, ICommentJob, ICommentNameList, IQueryComment, IQuerySort } from '@comment/interfaces/comment.interface';
import { CommentsModel } from '@comment/models/comment.schema';
import { INotificationDocument, INotificationTemplate } from '@notification/interfaces/notification.interface';
import { NotificationModel } from '@notification/models/notification.model';
import { IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { emailQueue } from '@service/queues/email.queue';
import { UserCache } from '@service/redis/user.cache';
import { socketIONotificationObject } from '@socket/notification';
import { IUserDocument } from '@user/interfaces/user.interface';
import { subnet } from 'ip';
import mongoose, { Query } from 'mongoose';

const userCache: UserCache = new UserCache();

class CommentService {
  public async addCommentToDB(data: ICommentJob): Promise<void> {
    // -------------------------------------------------------------------------
    // TODO: ⚠️ CRITICAL TECHNICAL DEBT (Consistency & Reliability)
    //
    // 1. DB Atomicity & Load (Promise.all):
    //    We execute 3 DB operations in parallel for performance.
    //    - Risk A: Partial Failure. If `commentCreated` succeeds but `postUpdate` fails,
    //      we have an orphaned comment and wrong count. (Need Transactions).
    //    - Risk B: Connection Pool Exhaustion. In high load, this triples the DB connections instantly.
    //
    // 2. Notification Reliability (Cache Dependency):
    //    We fetch the target user (`userTo`) ONLY from Redis cache.
    //    - Risk: Redis is volatile. If the user data is evicted/expired from cache,
    //      `response[2]` will be null. The code will silently SKIP sending the notification.
    //      The user will never know someone commented.
    //
    // FUTURE FIXES:
    // - Use MongoDB Transactions (Sessions) for atomic writes.
    // - Implement Cache-Aside pattern: If user not in Redis, fetch from MongoDB.
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

    if (response[2]?.notifications.comments && userFrom != userTo) {
      const notificationModel: INotificationDocument = new NotificationModel();
      const notifications = await notificationModel.insertNotification({
        userFrom,
        userTo,
        message: `${username} commented on your post`,
        notificationType: 'comment',
        entityId: new mongoose.Types.ObjectId(postId),
        createdItemId: new mongoose.Types.ObjectId(response[0]._id),
        createdAt: new Date(),
        comment: comment.comment,
        post: response[1].post,
        imgId: response[1].imgId!,
        imgVersion: response[1].imgVersion!,
        gifUrl: response[1].gifUrl!,
        reaction: ''
      });

      // -------------------------------------------------------------------------
      // TODO: 🚀 PERFORMANCE & PRIVACY UPGRADE (Targeted Sockets)
      //
      // Current Logic (Broadcast):
      // We are using `io.emit` which sends the notification to ALL connected users.
      // The filtering happens on the Client-Side (React checks if `userTo === myId`).
      // - Cons: High Bandwidth usage, Privacy risk (everyone receives everyone's data).
      //
      // FUTURE FIX (Rooms):
      // 1. On Connection: Make user's socket join a room named after their UserId.
      //    `socket.join(req.currentUser.userId)`
      // 2. On Notification: Send message ONLY to that specific room.
      //    `io.to(userTo).emit('insert notification', data)`
      // -------------------------------------------------------------------------
      socketIONotificationObject.emit('insert notification', notifications, { userTo });

      const templateParams: INotificationTemplate = {
        username: response[2].username!,
        message: `${username} commented on your post`,
        header: 'Comment Notification'
      };

      const template: string = notificationTemplate.notificationTemplate(templateParams);
      emailQueue.addEmailJob('commentsEmail', {
        template,
        receiverEmail: response[2].email!,
        subject: 'Post Notification'
      });
    }
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
          count: { $sum: 1 }
        }
      },
      { $project: { _id: 0 } }
    ]);

    if (commentsNamesList.length > 0) {
      return commentsNamesList[0];
    }

    return { names: [], count: 0 };
  }
}

export const commentService: CommentService = new CommentService();
