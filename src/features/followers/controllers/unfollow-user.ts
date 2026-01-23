import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { objectIdSchema } from '@global/helpers/joi.schema';
import { BadRequestError, NotFoundError } from '@global/helpers/error-handler';
import { followerService } from '@service/db/follower.service';

class Remove {
  public follower = async (req: Request, res: Response): Promise<void> => {
    const { followeeId } = req.params;
    const followerId = req.currentUser!.userId;

    // 1. Validation & Safety Checks
    const { error } = objectIdSchema.validate({ param: followeeId });
    if (error) throw new BadRequestError(error.details[0].message);

    // 2. Call Service 📞
    await followerService.removeFollowerFromDB(followeeId, followerId);

    // 3. Response 🚀
    res.status(HTTP_STATUS.OK).json({ message: 'Unfollowed user now' });
  };
}

export const remove: Remove = new Remove();
