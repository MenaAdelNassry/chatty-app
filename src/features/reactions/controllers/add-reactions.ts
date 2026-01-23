import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import HTTP_STATUS from 'http-status-codes';
import { joiRequestValidationError, NotFoundError } from '@global/helpers/error-handler';
import { IReactionDocument, IReactionJob } from '@reaction/interfaces/reaction.interface';
import { addReactionSchema } from '@reaction/schemes/reaction.schemes';
import { ReactionCache } from '@service/redis/reaction.cache';
import { reactionQueue } from '@service/queues/reaction.queue';
import { reactionService } from '@service/db/reaction.service';
import { postService } from '@service/db/post.service';
import { PostCache } from '@service/redis/post.cache';

const reactionCache: ReactionCache = new ReactionCache();
const postCache: PostCache = new PostCache();

class Add {
  public reaction = async (req: Request, res: Response): Promise<void> => {
    // 1. Validate Input
    const { error } = addReactionSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    const { postId, type } = req.body;
    const { userId } = req.currentUser!;

    const cachedPost = await postCache.getPostFromCache(postId, userId);
    const post = cachedPost ? cachedPost : await postService.getOnePost(postId, userId);

    if(!post) {
      throw new NotFoundError("Post not found");
    }

    // 2. Get Previous Reaction (Server Side Check)
    const userPreviousReactionObject = await reactionCache.getSingleReactionByUserIdFromCache(postId, req.currentUser!.userId);
    let previousReaction = userPreviousReactionObject.length ? userPreviousReactionObject[0].type : undefined;

    if (!previousReaction) {
      const dbReaction = await reactionService.getSinglePostReactionByUserId(postId, req.currentUser!.userId);
      if (dbReaction.length) {
        previousReaction = dbReaction[0].type;
      }
    }

    if (previousReaction === type) {
      res.status(HTTP_STATUS.OK).json({ message: 'Reaction already added' });
      return;
    }

    // 3. Construct Reaction Object (Secure Source)
    const reactionObject: IReactionDocument = {
      _id: new ObjectId(),
      postId,
      type,
      userId: req.currentUser!.userId,
      username: req.currentUser!.username,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture: req.currentUser!.profilePicture,
      createdAt: new Date()
    } as IReactionDocument;

    // 4. Save To Cache
    await reactionCache.savePostReactionToCache(postId, reactionObject, type, previousReaction);

    // 5. Add Queue Job (for DB)
    const databaseReactionData: IReactionJob = {
      postId,
      userFrom: req.currentUser!.userId,
      username: req.currentUser!.username,
      type,
      previousReaction: previousReaction || "",
      reactionObject,
      userTo: post.userId
    };

    reactionQueue.addReactionJob('addReactionToDB', databaseReactionData);

    // 6. Response
    res.status(HTTP_STATUS.OK).json({ message: 'Reaction added successfully' });
  };
}

export const add: Add = new Add();
