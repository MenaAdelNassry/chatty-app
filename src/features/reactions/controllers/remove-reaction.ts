import HTTP_STATUS from 'http-status-codes';
import { IReactionJob } from "@reaction/interfaces/reaction.interface";
import { reactionQueue } from "@service/queues/reaction.queue";
import { ReactionCache } from "@service/redis/reaction.cache";
import { Request, Response } from "express";

const reactionCache: ReactionCache = new ReactionCache();

class Remove {
  public reaction = async (req: Request, res: Response) => {
    const { postId } = req.params;
    const { postReactions } = req.body;

    const { type } = await reactionCache.removePostReactionFromCache(postId, req.currentUser!.username, postReactions);

    const reactionJobData: IReactionJob = {
      postId,
      username: req.currentUser!.username,
      previousReaction: type
    }
    reactionQueue.addReactionJob("removeReactionFromDB", reactionJobData);

    res.status(HTTP_STATUS.OK).json({ message: 'Reaction removed from post' });
  }
}

export const remove: Remove = new Remove();
