import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { imageQueue } from '@service/queues/image.queue';
import { UserCache } from '@service/redis/user.cache';
import { imageService } from '@service/db/image.service';
import { socketIOUserObject } from '@socket/user';

const userCache: UserCache = new UserCache();

class Delete {
  public async image(req: Request, res: Response): Promise<void> {
    const { imageId } = req.params;
    const { userId } = req.currentUser!;

    // 1. Execute Business Logic (DB Ops, Validation, User Update)
    const { image, user } = await imageService.validateAndRemoveImage(imageId, userId);

    // 2. Handle Side Effects: Cache & Socket ⚡
    if (user) {
      // Full Cache Repair/Update
      await userCache.saveUserToCache(`${user._id}`, req.currentUser!.uId, user);

      // Real-time Update
      socketIOUserObject.to(`user:${userId}`).emit('update user', user);
    }

    // 3. Handle Side Effects: Cloudinary Cleanup ☁️
    imageQueue.addImageJob('removeImageFromCloudinary', {
      imageId: image.publicId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Image deleted successfully' });
  }
}

export const del: Delete = new Delete();
