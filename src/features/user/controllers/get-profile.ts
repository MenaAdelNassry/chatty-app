import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { UserCache } from '@service/redis/user.cache';
import { userService } from '@service/db/user.service';
import { FollowerCache } from '@service/redis/follower.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { BadRequestError, NotFoundError } from '@global/helpers/error-handler';
import { followerService } from '@service/db/follower.service';
import { blockUserService } from '@service/db/block-user.service';

const userCache: UserCache = new UserCache();
const followerCache: FollowerCache = new FollowerCache();

class Get {
  // 1. Get My Profile (Login/Auth User) 👤
  public async profile(req: Request, res: Response): Promise<void> {
    const { userId, uId } = req.currentUser!;

    const cachedUser: IUserDocument | null = await userCache.getUserFromCache(req.currentUser!.userId);
    const existingUser: IUserDocument | null = cachedUser ? cachedUser : await userService.getUserById(req.currentUser!.userId);

    if (!cachedUser && existingUser) {
      await userCache.saveUserToCache(userId, uId, existingUser);
    }

    res.status(HTTP_STATUS.OK).json({ message: 'Current user profile', user: existingUser });
  }

  // 2. Get Other User Profile by ID 🛡️
  public async profileByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const { userId: myId } = req.currentUser!;

    const [isUserBlockedMe, isUserBlocked] = await Promise.all([
      followerCache.isUserBlockedBy(myId, userId),
      followerCache.isUserBlockedBy(userId, myId)
    ]);

    if(isUserBlocked || isUserBlockedMe) throw new BadRequestError('User not found');

    // A. Try Cache First
    const cachedUser: IUserDocument | null = await userCache.getUserFromCache(userId);
    let existingUser = cachedUser;

    if (!existingUser) {
      // B. Fallback to DB
      existingUser = await userService.getUserById(userId, myId);
      await userCache.saveUserToCache(userId, existingUser.uId!, existingUser);
    } else {
      const isFollowing = await followerCache.isUserFollowing(myId, userId);
      existingUser.isFollowing = isFollowing; // Inject Property
    }

    if (!existingUser || existingUser.freezedAt || !existingUser.emailVerified) {
      throw new NotFoundError('User not found');
    }

    res.status(HTTP_STATUS.OK).json({ message: 'User profile', user: existingUser });
  }

  // 3. User Suggestions (Random Users)
  public async randomUserNodes(req: Request, res: Response): Promise<void> {
    const { userId } = req.currentUser!;

    // A. Prepare Exclusion List (The "Don't Show" List) 🚫
    const excludeIds: string[] = [userId]; // 1. Exclude Myself

    const cachedFollowees: string[] = await followerCache.getFolloweesFromCache(`following:${userId}`);
    const followingIds: string[] = cachedFollowees.length
      ? cachedFollowees
      : await followerService.getFolloweeIds(userId);

    const dbBlockIds: string[] = await blockUserService.getExclusionBlockIds(userId);

    excludeIds.push(...followingIds, ...dbBlockIds);

    const users: IUserDocument[] = await userService.getRandomUsersFromDB(excludeIds, followingIds);

    res.status(HTTP_STATUS.OK).json({ message: 'User suggestions', users });
  }
}

export const get: Get = new Get();
