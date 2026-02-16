import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from 'express';
import { basicInfoSchema, changePasswordSchema, notificationSettingsSchema, socialLinksSchema } from '@user/schemes/info';
import { joiRequestValidationError } from '@global/helpers/error-handler';
import { userService } from '@service/db/user.service';
import { emailQueue } from '@service/queues/email.queue';
import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';

const userCache: UserCache = new UserCache();

class Update {
  public password = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = changePasswordSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    const { currentPassword, newPassword } = value;
    const { email, username } = req.currentUser!;

    // A. Update in DB (Critical Operation - Sync)
    await userService.updatePassword(username, newPassword, currentPassword);

    // B. Get Client IP Address (Fixed) 🌍
    // 'x-forwarded-for' is standard for apps behind proxies (Nginx/Heroku/AWS)
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress;

    // C. Send Confirmation Email (Async via Queue)
    emailQueue.addEmailJob('changePassword', { receiverEmail: email, subject: 'Password update confirmation', username, ip });

    // D. Logout / Session Invalidation 🚪
    req.session = null;

    res.status(HTTP_STATUS.OK).json({
      message: 'Password updated successfully. You will be redirected shortly to the login page.',
      action: 'logout' // Hint for Frontend to clear local storage
    });
  };

  public info = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = basicInfoSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    const { quote, work, school, location } = value;

    // Update Cache
    await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      quote,
      work,
      school,
      location
    });

    // Update DB
    userQueue.addUserJob('updateUserInfoInDB', {
      key: req.currentUser!.userId,
      value
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Basic information updated successfully' });
  };

  public social = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = socialLinksSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // Update Cache , note: frontend should send all fields in social not only updated
    await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      social: value
    });

    // Update DB
    userQueue.addUserJob('updateSocialLinksInDB', {
      key: req.currentUser!.userId,
      value
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Social links updated successfully' });
  };

  public notification = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = notificationSettingsSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // Update Cache , note: frontend should send all fields in notifications not only updated
    await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      notifications: value
    });

    userQueue.addUserJob('updateNotificationSettingsInDB', {
      key: req.currentUser!.userId,
      value
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Notification settings updated successfully' });
  };
}

export const update: Update = new Update();
