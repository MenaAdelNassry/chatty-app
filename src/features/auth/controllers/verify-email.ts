import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { UserCache } from '@service/redis/user.cache';
import { AuthModel } from '@auth/models/auth.schema';
import { BadRequestError, joiRequestValidationError } from '@global/helpers/error-handler';
import JWT from 'jsonwebtoken';
import { config } from '@root/config';
import { UserModel } from '@user/models/user.schema';
import { verifyOtpSchema } from '@auth/schemes/password';

const userCache: UserCache = new UserCache();

export class VerifyEmail {
  public async update(req: Request, res: Response): Promise<void> {
    // Validate Input
    const { error } = verifyOtpSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    const { otp } = req.body;
    const { email, userId, username, uId, role, avatarColor, profilePicture } = req.currentUser!;

    // 1. Check Redis
    const verification = await userCache.verifyOTP('signup', email, otp);
    if (!verification.valid) {
      throw new BadRequestError(verification.message);
    }

    // 2. Update Database (Auth Collection) And Cache
    const updatedInAuthDB = AuthModel.updateOne(
      { email: email },
      { $set: { emailVerified: true } }
    );
    const updatedInUserDB = UserModel.updateOne(
      { _id: userId },
      { $set: { emailVerified: true } }
    );
    const updateInCache = userCache.updateUserItemsInCache(userId, { emailVerified: true });
    await Promise.all([ updateInCache, updatedInAuthDB, updatedInUserDB ]);

    // 3. Generate NEW Token (Crucial Step!) 🔑
    const userJwt: string = JWT.sign(
      {
        userId, uId, email, username, role, avatarColor, profilePicture,
        tokenVersion: req.currentUser!.tokenVersion,
        emailVerified: true
      },
      config.JWT_TOKEN!,
      { expiresIn: '7d' }
    );

    req.session = { token: userJwt };

    res.status(HTTP_STATUS.OK).json({
      message: 'Email verified successfully.',
      token: userJwt,
    });
  }
}

export const verify: VerifyEmail = new VerifyEmail();
