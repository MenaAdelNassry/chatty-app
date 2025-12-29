import { ObjectId } from 'mongodb';
import { ICommentDocument, ICommentJob } from "@comment/interfaces/comment.interface";
import { addCommentSchema } from "@comment/schemes/comment";
import { joiRequestValidationError } from "@global/helpers/error-handler";
import { CommentCache } from "@service/redis/comment.cache";
import { Request, Response } from "express";
import { commentQueue } from '@service/queues/comment.queue';
import HTTP_STATUS from "http-status-codes";

const commentCache: CommentCache = new CommentCache();

class Add {
  public comment = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Apply Validation -----------------
    const { value, error } = addCommentSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // ----------------- Extracting Data -----------------
    // -------------------------------------------------------------------------
    // TODO: ⚠️ SECURITY CRITICAL WARNING (Technical Debt) ⚠️
    // We are taking 'userTo' (Post Owner) directly from the request body.
    // This allows malicious users to spoof notifications (e.g., User A comments on User B's post,
    // but sends User C's ID as 'userTo', triggering a fake notification for User C).
    //
    // FUTURE FIX:
    // Fetch the Post Owner from the DB/Cache using 'postId' inside the controller
    // or service, instead of trusting the client input.
    // -------------------------------------------------------------------------
    const { postId, userTo, profilePicture, comment } = value;

    const username = req.currentUser!.username;
    const avatarColor = req.currentUser!.avatarColor;
    const userId = req.currentUser!.userId;
    console.log(userId)

    // ----------------- Object Construction (Inlined) -----------------
    const commentData: ICommentDocument = {
      _id: new ObjectId(),
      postId,
      username,
      avatarColor,
      profilePicture,
      comment,
      createdAt: new Date()
    } as ICommentDocument;

    // ----------------- Save Comment To Cache -----------------
    await commentCache.savePostCommentToCache(postId, commentData);

    // ----------------- Add Comment Job To Queue -----------------
    const databaseCommentData: ICommentJob = {
      postId,
      userTo,
      userFrom: userId,
      username,
      comment: commentData,
    };

    commentQueue.addCommentJob('addCommentToDB', databaseCommentData);

    // ----------------- Finally, The Response -----------------
    res.status(HTTP_STATUS.CREATED).json({ message: "Comment created successfully" });
  }
}

export const add: Add = new Add();
