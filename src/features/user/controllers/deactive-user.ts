import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from 'express';
import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';
import { authService } from '@service/db/auth.service';
import { userService } from '@service/db/user.service';
import { joiRequestValidationError, BadRequestError, NotAuthorizedError } from '@global/helpers/error-handler';
import { UserRole } from '@user/interfaces/user.interface';
import { deactivateSchema } from '@user/schemes/info';
import { emailQueue } from '@service/queues/email.queue';

const userCache: UserCache = new UserCache();

class Deactivate {
  // ==========================================
  // 1. User Self-Deactivation
  // ==========================================
  public async deactivateSelf(req: Request, res: Response): Promise<void> {
    // 1. Validation (Password is required)
    const { error } = deactivateSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    const { password } = req.body;
    const { userId, username } = req.currentUser!;

    // 2. Check Password Correctness
    const existingAuthUser = await authService.getAuthUserByUsername(username);
    if (!existingAuthUser) {
      throw new BadRequestError('Invalid credentials');
    }

    const passwordMatch = await existingAuthUser.comparePassword(password);
    if (!passwordMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    // 3. Prepare Update Data: Auth (tokenVersion), User (freezed info)
    await userCache.updateUserItemsInCache(userId, {
      freezedAt: new Date().toISOString(),
      freezedBy: userId
    });

    userQueue.addUserJob('updateUserState', {
      key: userId,
      authId: `${existingAuthUser._id}`,
      freezedBy: userId,
      type: 'freeze'
    });

    // 4. Logout (Clear Cookie/Session)
    req.session = null;

    // 5. Send Email
    emailQueue.addEmailJob('deactivateAccount', {
      receiverEmail: existingAuthUser.email,
      type: 'self',
      username: existingAuthUser.username,
      subject: 'Account Deactivation Confirmation'
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Account deactivated successfully', token: null });
  }

  // ==========================================
  // 2. Admin Freeze User
  // ==========================================
  public async adminFreezeUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const adminId = req.currentUser!.userId;
    const userRole = req.currentUser!.role;

    // 1. Check if the requester is actually an Admin
    if (userRole !== UserRole.ADMIN) {
      throw new NotAuthorizedError('Only admins can perform this action.');
    }

    // 2. Check if the target user exists & is NOT an Admin
    const targetUser = await userService.getUserById(userId);
    if (!targetUser) {
      throw new BadRequestError('User not found');
    }

    if (targetUser.role === UserRole.ADMIN) {
      throw new BadRequestError('Cannot freeze another admin.');
    }

    // 3. Update Redis
    await userCache.updateUserItemsInCache(userId, {
      freezedAt: new Date().toISOString(),
      freezedBy: adminId
    });

    // 4. Update DB (Queue)
    userQueue.addUserJob('updateUserState', {
      key: userId,
      authId: `${targetUser.authId}`,
      freezedBy: adminId,
      type: 'freeze'
    });

    // 5. Send Email
    emailQueue.addEmailJob('deactivateAccount', {
      receiverEmail: targetUser.email!,
      type: 'admin',
      username: targetUser.username!,
      subject: 'Important: Your Account Has Been Suspended'
    });

    res.status(HTTP_STATUS.OK).json({ message: 'User has been frozen successfully' });
  }
}

export const deactivate: Deactivate = new Deactivate();
