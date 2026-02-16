import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from 'express';
import JWT from 'jsonwebtoken';
import { config } from '@root/config';
import { authService } from '@service/db/auth.service';
import { BadRequestError, joiRequestValidationError, NotAuthorizedError, NotFoundError } from '@global/helpers/error-handler';
import { loginSchema } from '@auth/schemes/signin';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';
import { UserCache } from '@service/redis/user.cache';

const userCache: UserCache = new UserCache();

class Signin {
  public read = async (req: Request, res: Response) => {
    // Apply Validation
    const { value, error } = loginSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // Check If Username Existed
    const { email, password, keepLoggedIn } = value;
    const existingAuthUser: IAuthDocument = await authService.getAuthUserByEmail(email);
    if (!existingAuthUser) {
      throw new BadRequestError('Invalid credentials');
    }

    // Check If Password Existed
    const passwordMatch = await existingAuthUser.comparePassword(password);
    if (!passwordMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    // Check from freezing account
    const user: IUserDocument = await userService.getUserByAuthId(`${existingAuthUser._id}`);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.freezedAt && user.freezedBy) {
      if (user.freezedBy.toString() === user._id.toString()) {
        await userService.unfreezeUser(`${user._id}`, `${user._id}`);

        user.freezedAt = undefined;
        user.freezedBy = undefined;
        user.restoredAt = new Date();
        user.restoredBy = user._id;

        await userCache.updateUserItemsInCache(user._id.toString(), {
          freezedBy: '',
          freezedAt: '',
          restoredAt: user.restoredAt.toISOString() || '',
          restoredBy: user.restoredBy.toString() || '',
        });

      } else {
        throw new NotAuthorizedError('Your Account is banned.');
      }
    }

    // Generate JWT
    const userJwt: string = JWT.sign(
      {
        userId: user._id,
        uId: existingAuthUser.uId,
        email: existingAuthUser.email,
        username: existingAuthUser.username,
        avatarColor: existingAuthUser.avatarColor,
        profilePicture: user.profilePicture,
        tokenVersion: existingAuthUser.tokenVersion ?? 0,
        emailVerified: existingAuthUser.emailVerified,
        role: user.role
      },
      config.JWT_TOKEN!,
      { expiresIn: '7d' }
    );

    req.session = { token: userJwt };
    if (keepLoggedIn) {
      req.sessionOptions.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 Days
    } else {
      req.sessionOptions.maxAge = undefined;
    }

    // Finally, The Response
    const userDocument: IUserDocument = {
      ...user,
      authId: existingAuthUser._id,
      username: existingAuthUser.username,
      email: existingAuthUser.email,
      avatarColor: existingAuthUser.avatarColor,
      uId: existingAuthUser.uId,
      createdAt: existingAuthUser.createdAt
    } as IUserDocument;
    res.status(HTTP_STATUS.OK).json({ message: 'User login successfully', user: userDocument, token: userJwt });
  };

  public async googleAuth(req: Request, res: Response): Promise<void> {
    const user = req.user as IUserDocument;

    // 1. Generate Token
    const userJwt: string = JWT.sign(
      {
        userId: `${user._id}`,
        uId: user.uId,
        email: user.email,
        username: user.username,
        avatarColor: user.avatarColor,
        tokenVersion: user.tokenVersion,
        role: user.role,
        emailVerified: user.emailVerified,
        profilePicture: user.profilePicture
      },
      config.JWT_TOKEN!,
      { expiresIn: '7d' }
    );

    // 2. Set Session
    req.session = { token: userJwt };
    req.sessionOptions.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 Days

    // 3. Redirect to Frontend 🚀
    res.redirect(`${config.CLIENT_URL}/app/social/streams`);
  }
}

export const signin: Signin = new Signin();
