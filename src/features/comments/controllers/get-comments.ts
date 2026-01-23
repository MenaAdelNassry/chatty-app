import { Request, Response } from 'express';
import mongoose from 'mongoose';
import HTTP_STATUS from 'http-status-codes';
import { ICommentDocument, ICommentNameList } from '@comment/interfaces/comment.interface';
import { commentService } from '@service/db/comment.service';
import { CommentCache } from '@service/redis/comment.cache';
import { postService } from '@service/db/post.service';

const commentCache: CommentCache = new CommentCache();

class Get {
  public comments = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const { userId } = req.currentUser!;

    await postService.checkPostPrivacyAndBlocking(postId, userId);

    const cachedComments: ICommentDocument[] = await commentCache.getCommentsFromCache(postId);
    let comments: ICommentDocument[] = cachedComments;

    if (comments.length === 0) {
      comments = await commentService.getPostComments({ postId: new mongoose.Types.ObjectId(postId) }, { createdAt: -1 });
      await commentCache.saveCommentsToCache(postId, comments);
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Post comments',
      comments: comments,
      count: comments.length
    });
  };

  public singleComment = async (req: Request, res: Response): Promise<void> => {
    const { postId, commentId } = req.params;
    const { userId } = req.currentUser!;

    await postService.checkPostPrivacyAndBlocking(postId, userId);

    const cachedComment: ICommentDocument | null = await commentCache.getSingleCommentFromCache(postId, commentId);

    const comments: ICommentDocument[] = cachedComment
      ? [cachedComment]
      : await commentService.getPostComments({ _id: new mongoose.Types.ObjectId(commentId) }, { createdAt: -1 });

    res.status(HTTP_STATUS.OK).json({
      message: 'Single comment',
      comments: comments
    });
  };
}

export const get: Get = new Get();
