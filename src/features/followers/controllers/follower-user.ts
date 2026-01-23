import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import HTTP_STATUS from 'http-status-codes';
import { objectIdSchema } from '@global/helpers/joi.schema';
import { BadRequestError } from '@global/helpers/error-handler';
import { followerService } from '@service/db/follower.service';

class Add {
  public follower = async (req: Request, res: Response): Promise<void> => {
    const { followeeId } = req.params;
    const followerId = req.currentUser!.userId;

    // 1. Validation: Validate ObjectId
    const { error } = objectIdSchema.validate({ param: followeeId });
    if (error) throw new BadRequestError(error.details[0].message);

    // 2. Call Service 📞
    const followerDocumentId: ObjectId = new mongoose.Types.ObjectId();
    await followerService.addFollowerToDB(
      followerId, // Follower (Who performs action)
      followeeId, // Followee (Target)
      req.currentUser!.username, // For Notification message
      followerDocumentId.toString()
    );

    // 3. Response 🚀
    res.status(HTTP_STATUS.OK).json({ message: 'Following user now' });
  };
}

export const add: Add = new Add();
