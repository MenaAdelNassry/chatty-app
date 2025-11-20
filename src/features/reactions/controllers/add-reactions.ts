// ---------------------------------------------------------
// ⚠️ SECURITY CRITICAL WARNING ⚠️
// This implementation trusts the client with the counter logic.
// In production, we MUST fetch current reactions from Cache/DB,
// calculate the increment/decrement here in the backend,
// and ignore the 'postReactions' sent from the body.
// ---------------------------------------------------------

import { ObjectId } from 'mongodb';
import { joiRequestValidationError } from "@global/helpers/error-handler";
import { IReactionDocument, IReactionJob } from "@reaction/interfaces/reaction.interface";
import { addReactionSchema } from "@reaction/schemes/reaction.schemes";
import { Request, Response } from "express";
import { ReactionCache } from '@service/redis/reaction.cache';
import HTTP_STATUS from "http-status-codes";
import { reactionQueue } from '@service/queues/reaction.queue';

const reactionCache: ReactionCache = new ReactionCache();

class Add {
  public reaction = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Apply Validation -----------------
    const { value, error } = addReactionSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // ----------------- Reaction Object Prepration -----------------
    const { userTo, postId, type, previousReaction, postReactions, profilePicture } = value;
    const reactionObject: IReactionDocument = {
      _id: new ObjectId(),
      postId,
      type,
      profilePicture,
      avataColor: req.currentUser!.avatarColor,
      username: req.currentUser!.username,
    } as IReactionDocument;

    // ----------------- Save To Cache -----------------
    await reactionCache.savePostReactionToCache(postId, reactionObject, postReactions, type, previousReaction);

    // ----------------- Add Queue Job(for DB) -----------------
    const databaseReactionData: IReactionJob = {
      postId,
      userTo,
      userFrom: req.currentUser!.userId,
      username: req.currentUser!.username,
      type,
      previousReaction,
      reactionObject
    };
    reactionQueue.addReactionJob("addReactionToDB", databaseReactionData);

    // ----------------- Finally, Response -----------------
    res.status(HTTP_STATUS.OK).json({ message: 'Reaction added successfully' });
  }
}

export const add: Add = new Add();
