import HTTP_STATUS from 'http-status-codes';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '@global/helpers/error-handler';
import { userService } from '@service/db/user.service';
import { userQueue } from '@service/queues/user.queue';
import { UserCache } from '@service/redis/user.cache';
import { UserRole } from '@user/interfaces/user.interface';
import { Request, Response } from 'express';
import { emailQueue } from '@service/queues/email.queue';

const userCache: UserCache = new UserCache();

class Activate {
  public async adminUnfreezeUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const adminId = req.currentUser!.userId;
    const userRole = req.currentUser!.role;

    // 1. Check Admin Privileges
    if (userRole !== UserRole.ADMIN) {
      throw new NotAuthorizedError('Only admins can perform this action.');
    }

    // 2. Check User Existence
    const existingUser = await userService.getUserById(userId);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }
    if(!existingUser.freezedAt) {
      throw new BadRequestError('User already active');
    }

    // 3. Update Redis Cache (Remove Freeze Flags)
    await userCache.updateUserItemsInCache(userId, {
      freezedAt: '', // Empty string -> deserializes to undefined
      freezedBy: '',
      restoredAt: new Date().toISOString(),
      restoredBy: adminId
    });

    // 4. Update DB (Queue)
    userQueue.addUserJob('updateUserState', {
      key: userId,
      authId: `${existingUser.authId}`,
      type: 'unfreeze',
      restoredBy: adminId
    });

    // 5. Send Email Notification
    emailQueue.addEmailJob('deactivateAccount', {
      receiverEmail: existingUser.email!,
      type: 'restore',
      username: existingUser.username!,
      subject: 'Good News: Your Account is Active Again!'
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User account restored successfully' });
  }
}

export const activate: Activate = new Activate();
