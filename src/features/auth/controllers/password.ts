import HTTP_STATUS from 'http-status-codes';
import { emailSchema, passwordSchema, verifyOtpSchema } from '@auth/schemes/password';
import { Request, Response } from 'express';
import { BadRequestError, joiRequestValidationError } from '@global/helpers/error-handler';
import { authService } from '@service/db/auth.service';
import { config } from '@root/config';
import { emailQueue } from '@service/queues/email.queue';
import { UserCache } from '@service/redis/user.cache';
import { Helpers } from '@global/helpers/helpers';
import Jwt from 'jsonwebtoken';

const userCache: UserCache = new UserCache();

const TTL: number = 60 * 5; // 5m

class Password {
  // Endpoint 1: Send OTP
  public async sendOTP(req: Request, res: Response): Promise<void> {
    // Apply Validation
    const { value, error } = emailSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    const { email } = value;
    const existingUser = await authService.getAuthUserByEmail(email);
    if (!existingUser) {
      // Security
      res.status(HTTP_STATUS.OK).json({ message: 'OTP sent to your email.' });
      return;
    }

    // Generate 6 digits code
    const otp = Helpers.getRandomOTP();

    // Save to Redis (5 mins, 0 attempts)
    await userCache.saveOTP('forgot', email, otp, TTL);

    // Send Email (Queue)
    emailQueue.addEmailJob('forgotPasswordEmail', {
      receiverEmail: email,
      subject: 'Reset your password',
      username: existingUser.username,
      otp,
      TTL
    });

    res.status(HTTP_STATUS.OK).json({ message: 'OTP sent to your email.' });
  }

  // Endpoint 2: Verify OTP
  public async verifyOTP(req: Request, res: Response): Promise<void> {
    // Validate Input
    const { error } = verifyOtpSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    const { email, otp } = req.body;

    // 1. Check Redis
    const verificationResult = await userCache.verifyOTP('forgot', email, otp);

    if (!verificationResult.valid) {
      throw new BadRequestError(verificationResult.message);
    }

    const resetToken = Jwt.sign({ email, type: 'password_reset_access' }, config.JWT_TOKEN!, { expiresIn: TTL });

    res.status(HTTP_STATUS.OK).json({
      message: 'OTP verified.',
      resetToken: resetToken
    });
  }

  // Endpoint 3: Reset Password
  public async resetPassword(req: Request, res: Response): Promise<void> {
    // Apply Validation
    const { error } = passwordSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    const { password, resetToken } = req.body;

    try {
      const decoded: any = Jwt.verify(resetToken, config.JWT_TOKEN!);

      if (decoded.type !== 'password_reset_access') {
        throw new BadRequestError('Invalid token type.');
      }

      const { email } = decoded;

      const existingUser = await authService.getAuthUserByEmail(email);
      if (!existingUser) throw new BadRequestError('User not found');

      // Change password and tokenVersion (logout from all devices) in DB
      existingUser.password = password;
      existingUser.tokenVersion = (existingUser.tokenVersion ?? 0) + 1;
      await existingUser.save();

      // Add email job confirmation
      const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress;
      emailQueue.addEmailJob('confirmPasswordEmail', {
        receiverEmail: existingUser.email,
        subject: 'Password reset confirmation',
        ip,
        username: existingUser.username,
      });

      res.status(HTTP_STATUS.OK).json({ message: 'Password reset successfully.' });
    } catch (error) {
      throw new BadRequestError('Reset session expired. Please verify OTP again.');
    }
  }
}

export const password: Password = new Password();
