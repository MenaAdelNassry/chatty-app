import HTTP_STATUS from 'http-status-codes';
import { IReactionDocument } from '@reaction/interfaces/reaction.interface';
import { reactionService } from '@service/db/reaction.service';
import { ReactionCache } from '@service/redis/reaction.cache';
import { Request, Response } from 'express';
import { postService } from '@service/db/post.service';

const reactionCache: ReactionCache = new ReactionCache();

class Get {
  public async reactions(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const { userId } = req.currentUser!;

    // 1. Security Check
    await postService.checkPostPrivacyAndBlocking(postId, userId);

    // 2. Get All Reactions for a Post (Cache First)
    const cachedReactions: [IReactionDocument[], number] = await reactionCache.getReactionsForPostFromCache(postId);

    let reactions: IReactionDocument[] = cachedReactions[0];
    let count: number = cachedReactions[1];

    // 3. Cache Miss Logic (Hydration) 🔄
    if (reactions.length === 0) {
      const dbResponse = await reactionService.getPostReactions({ postId }, { createdAt: -1 });
      reactions = dbResponse[0];
      count = dbResponse[1];

      if (reactions.length > 0) {
        await reactionCache.saveReactionsToCache(postId, reactions);
      }
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Post reactions',
      reactions: reactions,
      count: count
    });
  }

  public async singleReactionByUserId(req: Request, res: Response): Promise<void> {
    const { postId, userId } = req.params;

    const cachedReaction: [IReactionDocument, number] | [] = await reactionCache.getSingleReactionByUserIdFromCache(postId, userId);

    const postReaction: [IReactionDocument, number] | [] = cachedReaction.length
      ? cachedReaction
      : await reactionService.getSinglePostReactionByUserId(postId, userId);

    res.status(HTTP_STATUS.OK).json({
      message: 'Single post reaction by userId',
      reaction: postReaction.length ? postReaction[0] : {},
      count: postReaction.length ? postReaction[1] : 0
    });
  }

  public async reactionsByUsername(req: Request, res: Response): Promise<void> {
    const { username } = req.params;
    const reactions: IReactionDocument[] = await reactionService.getReactionsByUsername(username);

    res.status(HTTP_STATUS.OK).json({
      message: 'All user reactions by username',
      reactions
    });
  }
}

export const get: Get = new Get();
