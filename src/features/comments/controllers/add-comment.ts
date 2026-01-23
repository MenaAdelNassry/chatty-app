import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { ICommentDocument, ICommentJob } from '@comment/interfaces/comment.interface';
import { addCommentSchema } from '@comment/schemes/comment';
import { joiRequestValidationError, NotFoundError } from '@global/helpers/error-handler';
import { CommentCache } from '@service/redis/comment.cache';
import { commentQueue } from '@service/queues/comment.queue';
import { postService } from '@service/db/post.service';

const commentCache: CommentCache = new CommentCache();

class Add {
  public comment = async (req: Request, res: Response): Promise<void> => {
    // 1. Validation
    const { error } = addCommentSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // 2. Extract Data (Securely)
    const { postId, comment } = req.body;
    const { userId, username, avatarColor, profilePicture } = req.currentUser!;

    // 3. Check From Blocking And Privacy
    await postService.checkPostPrivacyAndBlocking(postId, userId);

    // 4. Construct Comment Object
    const commentObjectId = new ObjectId();

    const commentData: ICommentDocument = {
      _id: commentObjectId,
      postId,
      userId,
      username,
      avatarColor,
      profilePicture, // ✅ Taken from Token (Secure)
      comment,
      createdAt: new Date()
    } as ICommentDocument;

    // 5. Save To Cache
    await commentCache.savePostCommentToCache(postId, commentData);

    // 6. Add Job To Queue
    const databaseCommentData: ICommentJob = {
      postId,
      userFrom: userId,
      username,
      comment: commentData
    };

    commentQueue.addCommentJob('addCommentToDB', databaseCommentData);

    // 6. Response
    res.status(HTTP_STATUS.CREATED).json({ message: 'Comment created successfully' });
  };
}

export const add: Add = new Add();
