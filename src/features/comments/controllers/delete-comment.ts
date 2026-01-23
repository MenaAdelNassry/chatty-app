import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';
import { CommentCache } from '@service/redis/comment.cache';
import { commentService } from '@service/db/comment.service';
import { commentQueue } from '@service/queues/comment.queue';
import { ICommentJob, ICommentDocument } from '@comment/interfaces/comment.interface';
import { BadRequestError, NotFoundError } from '@global/helpers/error-handler';

const commentCache: CommentCache = new CommentCache();

class Delete {
  public comment = async (req: Request, res: Response): Promise<void> => {
    const { postId, commentId } = req.params;
    const { userId, username } = req.currentUser!;

    // 1. Get Comment
    let comment: ICommentDocument | null | undefined = await commentCache.getSingleCommentFromCache(postId, commentId);

    if (!comment) {
      const dbComments = await commentService.getPostComments({ _id: new mongoose.Types.ObjectId(commentId) }, { createdAt: -1 });
      comment = dbComments[0];
    }

    // 2. Ownership & Existence Check
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.userId.toString() !== userId) {
      throw new BadRequestError('You are not authorized to delete this comment.');
    }

    // 3. Remove from Cache
    await commentCache.deleteCommentFromCache(postId, comment);

    // 4. Queue Job
    const jobData: ICommentJob = {
      postId,
      userFrom: userId,
      username,
      comment: { _id: commentId } as any
    };

    commentQueue.addCommentJob('deleteCommentFromDB', jobData);

    res.status(HTTP_STATUS.OK).json({ message: 'Comment deleted successfully' });
  };
}

export const deleteComment: Delete = new Delete();
