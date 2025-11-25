import { socketIOImageObject } from '@socket/image';
import HTTP_STATUS from "http-status-codes";
import { imageQueue } from "@service/queues/image.queue";
import { Request, Response } from "express";
import { IFileImageDocument } from '@image/interfaces/image.interface';
import { imageService } from '@service/db/image.service';
import { UserCache } from '@service/redis/user.cache';
import { BadRequestError } from '@global/helpers/error-handler';

const userCache: UserCache = new UserCache();

class Delete {
  public image = async (req: Request, res: Response): Promise<void> => {
    const { imageId } = req.params;

    socketIOImageObject.emit("delete image", imageId);
    imageQueue.addImageJob("removeImageFromDB", { imageId });

    res.status(HTTP_STATUS.OK).json({ message: 'Image deleted successfully' });
  }

  public backgroundImage = async (req: Request, res: Response): Promise<void> => {
    const { bgImageId } = req.params;
    const image: IFileImageDocument | null = await imageService.getImageByBackgroundId(bgImageId);

    if(!image) {
      throw new BadRequestError('Image not found');
    }

    socketIOImageObject.emit('delete image', image!._id);

    await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      bgImageId: '',
      bgImageVersion: '',
    });

    imageQueue.addImageJob("removeImageFromDB", { imageId: image._id.toString() });

    res.status(HTTP_STATUS.OK).json({ message: 'Image deleted successfully' });
  }
}

export const del: Delete = new Delete();
