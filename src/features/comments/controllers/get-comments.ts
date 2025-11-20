import { ICommentDocument, ICommentNameList } from "@comment/interfaces/comment.interface";
import { commentService } from "@service/db/comment.service";
import { CommentCache } from "@service/redis/comment.cache";
import { Request, Response } from "express";
import mongoose from "mongoose";
import HTTP_STATUS from 'http-status-codes';

const commentCache: CommentCache = new CommentCache();

class Get {
  public comments = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const commentsFromCache: ICommentDocument[] = await commentCache.getCommentsFromCache(postId);

    const finalComments: ICommentDocument[] = commentsFromCache.length
      ? commentsFromCache
      : await commentService.getPostComments({ postId: new mongoose.Types.ObjectId(postId), }, { createdAt: -1 });

    res.status(HTTP_STATUS.OK).json({ message: 'Post comments', comments: finalComments });
  }

  public commentsNamesFromCache = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const cachedCommentsNames: ICommentNameList = await commentCache.getCommentsNamesFromCache(postId);

    const finalCommentsNames: ICommentNameList = cachedCommentsNames.count
      ? cachedCommentsNames
      : await commentService.getPostCommentNames({ postId: new mongoose.Types.ObjectId(postId), });

    res.status(HTTP_STATUS.OK).json({ message: 'Post comments names', comments: finalCommentsNames.names });
  }

  public singleComment = async (req: Request, res: Response): Promise<void> => {
    const { postId, commentId } = req.params;
    const cachedComment: (ICommentDocument | null) = await commentCache.getSingleCommentFromCache(postId, commentId);

    const finalComment: (ICommentDocument | null) = cachedComment
      ? cachedComment
      : (await commentService.getPostComments({ _id: new mongoose.Types.ObjectId(commentId) }, { createdAt: -1 }))[0];

    res.status(HTTP_STATUS.OK).json({ message: 'Single comment', comments: finalComment ? [finalComment] : [] });
  }
}

export const get: Get = new Get();
