import HTTP_STATUS from 'http-status-codes';
import { IReactionDocument } from "@reaction/interfaces/reaction.interface";
import { reactionService } from "@service/db/reaction.service";
import { ReactionCache } from "@service/redis/reaction.cache";
import { Request, Response } from "express";

const reactionCache: ReactionCache = new ReactionCache();

class Get {
  public async reactions(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    let postReactions: [IReactionDocument[], number];
    const cachedReactions: [IReactionDocument[], number] = await reactionCache.getReactionsForPostFromCache(postId);

    postReactions = cachedReactions[0].length
    ? cachedReactions
    : await reactionService.getPostReactions({ postId }, { createdAt: -1 });

    res.status(HTTP_STATUS.OK).json({ message: 'Post reactions', reactions: postReactions[0], count: postReactions[1] });
  }

  public async singleReactionByUsername(req: Request, res: Response): Promise<void> {
    const { postId, username } = req.params;

    let postReaction: [IReactionDocument, number] | [];
    const cachedRreation: [IReactionDocument, number] | [] = await reactionCache.getSingleReactionByUsernameFromCache(postId, username);

    postReaction = cachedRreation.length
    ? cachedRreation
    : await reactionService.getSinglePostReactionByUsername(postId, username);

    res.status(HTTP_STATUS.OK).json({
      message: 'Single post reaction by username',
      reactions: postReaction.length ? postReaction[0] : {},
      count: postReaction.length ? postReaction[1] : 0
    });
  }

  public async reactionsByUsername(req: Request, res: Response): Promise<void> {
    const { username } = req.params;
    const reactions: IReactionDocument[] = await reactionService.getReactionsByUsername(username);
    res.status(HTTP_STATUS.OK).json({ message: 'All user reactions by username', reactions });
  }
}

export const get: Get = new Get();
