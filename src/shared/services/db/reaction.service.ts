import { Helpers } from '@global/helpers/helpers';
import { IPostDocument } from '@post/interfaces/post.interface';
import { PostModel } from '@post/models/post.schema';
import { IQueryReaction, IReactionDocument, IReactionJob } from '@reaction/interfaces/reaction.interface';
import { ReactionModel } from '@reaction/models/reaction.schema';
import { UserCache } from '@service/redis/user.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { omit } from 'lodash';

const userCache: UserCache = new UserCache();

class ReactionService {
  public async addReactionDataToDB(reactionData: IReactionJob): Promise<void> {
    // TODO: ⚠️ SECURITY FIX REQUIRED ⚠️
    // Currently, we trust the 'req.body.userTo' to send notifications.
    // This allows malicious users to spoof notifications (e.g., User A likes a post, but sends User B's ID).
    // FIX: In production, DO NOT use 'userTo' from the arguments.
    // Instead, fetch the Post Owner from the DB using 'postId' inside this method.
    // const post = await PostModel.findById(postId);
    // const realUserTo = post.userId;
    const { postId, userTo, userFrom, username, type, previousReaction, reactionObject } = reactionData;
    let updatedReactionObject: IReactionDocument = reactionObject as IReactionDocument;

    if (previousReaction) {
      updatedReactionObject = omit(reactionObject, ['_id']) as IReactionDocument;
    }

    const updatedReaction: [IUserDocument, IReactionDocument, IPostDocument] = Promise.all([
      userCache.getUserFromCache(`${userTo}`),
      ReactionModel.replaceOne(
        { postId, username: Helpers.firstLetterUppercase(username), type: previousReaction },
        updatedReactionObject,
        { upsert: true }
      ),
      PostModel.findOneAndUpdate(
        { _id: postId },
        {
          $inc: {
            [`reactions.${type}`]: 1,
            [`reactions.${previousReaction}`]: -1
          }
        },
        { new: true }
      )
    ]) as unknown as [IUserDocument, IReactionDocument, IPostDocument];

    // send notifications later
  }

  public async removeReactionDataFromDB(reactionData: IReactionJob): Promise<void> {
    const { postId, username, previousReaction } = reactionData;

    await Promise.all([
      ReactionModel.deleteOne({ postId, username: Helpers.firstLetterUppercase(username), type: previousReaction }),
      PostModel.updateOne({ _id: postId }, { $inc: { [`reactions.${previousReaction}`]: -1 } })
    ]);
  }

  public async getPostReactions(query: IQueryReaction, sort: Record<string, 1 | -1>): Promise<[IReactionDocument[], number]> {
    const reactions: IReactionDocument[] = await ReactionModel.aggregate([{ $match: query }, { $sort: sort }]);

    return [reactions, reactions.length];
  }

  public async getSinglePostReactionByUsername(postId: string, username: string): Promise<[IReactionDocument, number] | []> {
    const reaction: IReactionDocument | null = await ReactionModel.findOne({
      postId,
      username: Helpers.firstLetterUppercase(username)
    });
    return reaction ? [reaction, 1] : [];
  }

  public async getReactionsByUsername(username: string): Promise<IReactionDocument[]> {
    const reactions: IReactionDocument[] = await ReactionModel.find({ username: Helpers.firstLetterUppercase(username) });
    return reactions;
  }
}

export const reactionService: ReactionService = new ReactionService();
