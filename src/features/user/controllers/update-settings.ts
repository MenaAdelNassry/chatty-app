import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from 'express';
import { basicInfoSchema, changePasswordSchema, notificationSettingsSchema, socialLinksSchema } from '@user/schemes/info';
import { joiRequestValidationError } from '@global/helpers/error-handler';
import { userService } from '@service/db/user.service';
import { IResetPasswordParams } from '@user/interfaces/user.interface';
import moment from 'moment';
import publicIP from 'ip';
import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';
import { emailQueue } from '@service/queues/email.queue';
import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';

const userCache: UserCache = new UserCache();

class Update {
  public password = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = changePasswordSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    const { currentPassword, newPassword } = value;
    const { email, username } = req.currentUser!;

    await userService.updatePassword(username, newPassword, currentPassword);

    const templateParams: IResetPasswordParams = {
      username,
      email,
      ipaddress: publicIP.address(),
      date: moment().format('DD/MM/YYYY HH:mm')
    };
    const template: string = resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);
    emailQueue.addEmailJob('changePassword', { template, receiverEmail: email, subject: 'Password update confirmation' });

    res.status(HTTP_STATUS.OK).json({
      message: 'Password updated successfully. You will be redirected shortly to the login page.'
    });
  }

  public info = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = basicInfoSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    const { quote, work, school, location } = value;

    await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      quote, work, school, location,
    });

    userQueue.addUserJob('updateUserInfoInDB', {
      key: req.currentUser!.userId,
      value,
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Basic information updated successfully' });
  }

  public social = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = socialLinksSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      social: value
    });

    userQueue.addUserJob('updateSocialLinksInDB', {
      key: req.currentUser!.userId,
      value,
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Social links updated successfully' });
  }

  public notification = async (req: Request, res: Response): Promise<void> => {
    const { value, error } = notificationSettingsSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      notifications: value
    });

    userQueue.addUserJob('updateNotificationSettingsInDB', {
      key: req.currentUser!.userId,
      value,
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Notification settings updated successfully' });
  }
}

export const update: Update = new Update
