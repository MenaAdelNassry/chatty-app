import { PostModel } from '@post/models/post.schema';
import { IQueryReaction, IReactionDocument, IReactionJob } from '@reaction/interfaces/reaction.interface';
import { ReactionModel } from '@reaction/models/reaction.schema';
import { notificationQueue } from '@service/queues/notification.queue';
import mongoose from 'mongoose';

class ReactionService {
  public async addReactionDataToDB(reactionData: IReactionJob): Promise<void> {
    const { postId, userFrom, type, previousReaction, reactionObject, userTo } = reactionData;

    // 1. Prepare Update Object Logic
    const reactionUpdateOp = {
      $inc: {
        [`reactions.${type}`]: 1
      }
    };

    if (previousReaction) {
      reactionUpdateOp.$inc[`reactions.${previousReaction}`] = -1;
    }

    // 2. Database Operations (Parallel)
    const [updatedPost, reactionDoc] = await Promise.all([
      PostModel.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(postId) }, reactionUpdateOp, { new: true }),
      ReactionModel.findOneAndUpdate(
        { postId, userId: userFrom },
        {
          $set: {
            type,
            username: reactionObject?.username,
            profilePicture: reactionObject?.profilePicture
          },

          $setOnInsert: {
            _id: reactionObject?._id,
            userId: userFrom,
            postId,
            createdAt: new Date()
          }
        },
        { upsert: true, new: true, runValidators: true }
      )
    ]);

    // 3. Notifications
    if (updatedPost && String(updatedPost.userId) !== userFrom) {
      if (previousReaction) {
        notificationQueue.addNotificationJob('updateNotification', { createdItemId: `${reactionDoc._id}`, reaction: type });
      } else {
        notificationQueue.addNotificationJob('insertNotification', {
          userFrom,
          userTo,
          message: `${reactionObject?.username} reacted on your post.`,
          notificationType: 'reactions',
          entityId: postId,
          createdItemId: `${reactionObject!._id}`,
          createdAt: new Date(),
          post: updatedPost.post,
          imgId: updatedPost.imgId,
          imgVersion: updatedPost.imgVersion,
          gifUrl: updatedPost.gifUrl,
          reaction: type,
        });
      }
    }
  }

  public async removeReactionDataFromDB(reactionData: IReactionJob): Promise<void> {
    const { postId, userFrom, previousReaction } = reactionData;

    const [deletedReactionDoc] = await Promise.all([
      ReactionModel.findOneAndDelete({ postId, userId: userFrom }),
      PostModel.updateOne({ _id: postId }, { $inc: { [`reactions.${previousReaction}`]: -1 } })
    ]);

    notificationQueue.addNotificationJob('deleteNotification', {
      createdItemId: `${deletedReactionDoc?._id}`
    });
  }

  public async getPostReactions(query: IQueryReaction, sort: Record<string, 1 | -1>): Promise<[IReactionDocument[], number]> {
    const reactions: IReactionDocument[] = await ReactionModel.find(query).sort(sort);
    return [reactions, reactions.length];
  }

  public async getSinglePostReactionByUserId(postId: string, userId: string): Promise<[IReactionDocument, number] | []> {
    const reaction: IReactionDocument | null = await ReactionModel.findOne({
      postId,
      userId
    });
    return reaction ? [reaction, 1] : [];
  }

  public async getReactionsByUsername(username: string): Promise<IReactionDocument[]> {
    const reactions: IReactionDocument[] = await ReactionModel.find({ username });
    return reactions;
  }
}

export const reactionService: ReactionService = new ReactionService();
