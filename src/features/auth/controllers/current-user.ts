import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from "express";
import { UserCache } from "@service/redis/user.cache";
import { IUserDocument } from "@user/interfaces/user.interface";
import { userService } from "@service/db/user.service";

const userCache: UserCache = new UserCache();

class CurrentUser {
  public async read(req: Request, res: Response): Promise<void> {
    let isUser = false;
    let token = null;
    let user = null;

    // 1. Try Cache
    const cachedUser: IUserDocument = await userCache.getUserFromCache(`${req.currentUser!.userId}`) as IUserDocument;

    // 2. Logic: If cache hit, use it. If miss, go to DB.
    const existingUser: IUserDocument = cachedUser ? cachedUser : await userService.getUserById(`${req.currentUser!.userId}`);

    // 3. ✅ OPTIMIZATION: Cache Repair (Write-back)
    if (Object.keys(existingUser).length && !cachedUser) {
      await userCache.saveUserToCache(`${existingUser._id}`, existingUser.uId!, existingUser);
    }

    if (Object.keys(existingUser).length) {
      isUser = true;
      token = req.session?.token;
      user = existingUser;
    }

    res.status(HTTP_STATUS.OK).json({ token, isUser, user });
  }
}

export const currentUser: CurrentUser = new CurrentUser();
