import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import { signupSchema } from '@auth/schemes/signup';
import { joiRequestValidationError } from '@global/helpers/error-handler';
import { authService } from '@service/db/auth.service';
import { IAuthDocument, ISignUpData } from '@auth/interfaces/auth.interface';
import { BadRequestError } from '@global/helpers/error-handler';
import { Helpers } from '@global/helpers/helpers';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from '@service/redis/user.cache';
import { config } from '@root/config';
import JWT from 'jsonwebtoken';
import { emailQueue } from '@service/queues/email.queue';
import { AuthHelper } from '@global/helpers/auth.helpers';

const userCache: UserCache = new UserCache();

class Signup {
  public create = async (req: Request, res: Response): Promise<void> => {
    // Apply Validation
    const { value, error } = signupSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // Check If (email) Exist
    const { username, email, password, avatarColor, avatarImage } = value;
    const checkIfUserExist: IAuthDocument | null = await authService.getAuthUserByEmail(email);
    if (checkIfUserExist) {
      throw new BadRequestError('This is email already exist!');
    }

    // Prepare Auth Data
    const authObjectId: ObjectId = new ObjectId();
    const userObjectId: ObjectId = new ObjectId();
    const uId = `${Helpers.generateRandomIntegers(12)}`;

    const authData: IAuthDocument = this.signupData({
      _id: authObjectId,
      username,
      email,
      avatarColor,
      password,
      uId
    });

    // Add Photo To Cloudinary And Image Collection
    const photoUrl = await AuthHelper.uploadUserProfileImage(avatarImage, userObjectId);

    // Add To Redis Cache And Save In DB (Auth and User Collections)
    const userData = await AuthHelper.createAndSaveUser(authData, userObjectId, photoUrl);

    // JWT Token
    const userJwt: string = this.signToken(userData);
    req.session = { token: userJwt };
    req.sessionOptions.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 Days (default)

    // Generate OTP & Send Email
    const otp = Helpers.getRandomOTP();
    const TTL = 60 * 5;

    await userCache.saveOTP('signup', authData.email, otp, TTL);

    emailQueue.addEmailJob('confirmEmail', {
      receiverEmail: authData.email,
      username: authData.username,
      otp,
      subject: 'Verify your email address'
    });

    // Finally, The Response
    res.status(HTTP_STATUS.CREATED).json({ message: 'User created successfully', user: userData, token: userJwt });
  };

  private signupData(data: ISignUpData): IAuthDocument {
    const { _id, username, password, email, uId, avatarColor } = data;
    return {
      _id,
      username: Helpers.firstLetterUppercase(username),
      password,
      email: Helpers.lowerCase(email),
      uId,
      avatarColor,
      createdAt: new Date(),
      tokenVersion: 0,
      emailVerified: false
    } as IAuthDocument;
  }

  private signToken(data: IUserDocument): string {
    return JWT.sign(
      {
        userId: `${data._id}`,
        uId: data.uId,
        email: data.email,
        username: data.username,
        avatarColor: data.avatarColor,
        profilePicture: data.profilePicture,
        tokenVersion: data.tokenVersion,
        role: data.role,
        emailVerified: data.emailVerified
      },
      config.JWT_TOKEN!
    );
  }
}

export const signup: Signup = new Signup();
