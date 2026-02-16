import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { UserCache } from '@service/redis/user.cache';
import { emailQueue } from '@service/queues/email.queue';
import { Helpers } from '@global/helpers/helpers';

const userCache: UserCache = new UserCache();

export class ResendOTP {
  public async handle(req: Request, res: Response): Promise<void> {
    // 1. Get User Data from Token (Logged in user)
    const { email, username } = req.currentUser!;

    // 2. Generate New OTP
    const otp = Helpers.getRandomOTP();
    const TTL = 60 * 5; // 5 Minutes renewal

    // 3. Save to Redis (Overwrite old one if exists)
    await userCache.saveOTP('signup', email, otp, TTL);

    // 4. Send Email
    emailQueue.addEmailJob('confirmEmail', {
      receiverEmail: email,
      username,
      otp,
      subject: 'New Verification Code'
    });

    // 5. Response
    res.status(HTTP_STATUS.OK).json({
      message: 'Verification code sent successfully. Please check your email.'
    });
  }
}

export const resendOtp: ResendOTP = new ResendOTP();
