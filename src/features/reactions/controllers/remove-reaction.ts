import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { IReactionJob } from '@reaction/interfaces/reaction.interface';
import { reactionQueue } from '@service/queues/reaction.queue';
import { ReactionCache } from '@service/redis/reaction.cache';
import { reactionService } from '@service/db/reaction.service';
import { PostCache } from '@service/redis/post.cache';
import { postService } from '@service/db/post.service';
import { NotFoundError } from '@global/helpers/error-handler';

const reactionCache: ReactionCache = new ReactionCache();
const postCache: PostCache = new PostCache();

class Remove {
  public reaction = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const { userId } = req.currentUser!;

    const cachedPost = await postCache.getPostFromCache(postId, userId);
    const post = cachedPost ? cachedPost : await postService.getOnePost(postId, userId);

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const cachedReaction = await reactionCache.getSingleReactionByUserIdFromCache(postId, req.currentUser!.userId);
    let previousReaction = cachedReaction.length ? cachedReaction[0] : undefined;

    if (!previousReaction) {
      const dbReaction = await reactionService.getSinglePostReactionByUserId(postId, req.currentUser!.userId);
      if (dbReaction.length) {
        previousReaction = dbReaction[0];
      }
    }

    if (!previousReaction) {
      res.status(HTTP_STATUS.OK).json({ message: 'Reaction removed from post' });
      return;
    }

    // 2. Remove from Cache 🗑️
    await reactionCache.removePostReactionFromCache(postId, req.currentUser!.userId, post, previousReaction.type);

    // 3. Queue Job (DB Update) 📨
    const databaseReactionData: IReactionJob = {
      postId,
      username: req.currentUser!.username,
      userFrom: req.currentUser!.userId,
      previousReaction: previousReaction.type
    };

    reactionQueue.addReactionJob('removeReactionFromDB', databaseReactionData);

    res.status(HTTP_STATUS.OK).json({ message: 'Reaction removed from post' });
  };
}

export const remove: Remove = new Remove();
