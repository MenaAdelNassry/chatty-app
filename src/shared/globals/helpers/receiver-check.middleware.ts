import { Request, Response, NextFunction } from 'express';
import { UserModel } from '@user/models/user.schema';
import { BadRequestError } from '@global/helpers/error-handler';
import { UserCache } from '@service/redis/user.cache';

const userCache: UserCache = new UserCache();

export const checkReceiverExists = async (req: Request, _res: Response, next: NextFunction) => {
  const { receiverId } = req.body;

  if (!receiverId) {
    return next();
  }

  // 1. Check Cache
  const cachedReceiver = await userCache.getUserFromCache(receiverId);

  if (cachedReceiver) {
    req.body.receiverData = cachedReceiver;
    return next();
  }

  // 2. Check DB
  const dbReceiver = await UserModel.findById(receiverId);
  if (!dbReceiver) {
    throw new BadRequestError('Receiver not found');
  }

  req.body.receiverData = dbReceiver;
  next();
};
