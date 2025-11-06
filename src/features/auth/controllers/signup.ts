import HTTP_STATUS from 'http-status-codes';
import { ObjectId } from "mongodb";
import { Request, Response } from "express";
import { signupSchema } from "@auth/schemes/signup";
import { joiRequestValidationError } from "@global/helpers/error-handler";
import { authService } from "@service/db/auth.service";
import { IAuthDocument, ISignUpData } from "@auth/interfaces/auth.interface";
import { BadRequestError } from "@global/helpers/error-handler";
import { Helpers } from "@global/helpers/helpers";
import { UploadApiResponse } from "cloudinary";
import { uploads } from "@global/helpers/cloudinary-upload";
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from "@service/redis/user.cache";
import { config } from '@root/config';
import { omit } from 'lodash';
import { authQueue } from '@service/queues/auth.queue';
import { userQueue } from '@service/queues/user.queue';
import JWT from 'jsonwebtoken';

const userCache: UserCache = new UserCache();

class Signup {
  public create = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Apply Validation -----------------
    const { value, error } = signupSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // ----------------- Check If (username | email) Exist  -----------------
    const { username, email, password, avatarColor, avatarImage } = value;
    const checkIfUserExist: IAuthDocument | null = await authService.getUserByUsernameOrEmail(username, email);
    if(checkIfUserExist) {
      throw new BadRequestError("Invalid credentials");
    }

    // ----------------- Cloudinary Function  -----------------
    const authObjectId: ObjectId = new ObjectId();
    const userObjectId: ObjectId = new ObjectId();
    const uId = `${Helpers.generateRandomIntegers(12)}`;

    const authData: IAuthDocument = this.signupData({
      _id: authObjectId,
      username,
      email,
      avatarColor,
      password,
      uId,
    });
    const result: UploadApiResponse = await uploads(avatarImage, `${userObjectId}`, true, true) as UploadApiResponse
    if(!result?.public_id) {
      throw new BadRequestError("File upload: Error occured. Try again");
    }

    // ----------------- Add To Redis Cache  -----------------
    const userDataForCache: IUserDocument = this.userData(authData, userObjectId);
    userDataForCache.profilePicture = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${userObjectId}`;
    userCache.saveUserToCache(`${userObjectId}`, uId, userDataForCache);

    // ----------------- Save User To DB  -----------------
    const dataForUserQueue: IUserDocument = omit(userDataForCache, [ 'uId', 'username', 'email', 'avatarColor', 'password' ]);
    authQueue.addAuthUserJob('addAuthUserToDB', { value: authData });
    userQueue.addUserJob("addUserToDB", { value: dataForUserQueue });

    // ----------------- JWT Token  -----------------
    const userJwt: string = this.signToken(authData, userObjectId);
    req.session = { token: userJwt };

    // ----------------- Finally, The Response  -----------------
    res.status(HTTP_STATUS.CREATED).json({ message: "User created successfully", user: userDataForCache, token: userJwt });
  }

  private signupData(data: ISignUpData): IAuthDocument {
    const { _id, username, password, email, uId, avatarColor } = data;
    return {
      _id,
      username: Helpers.firstLetterUppercase(username),
      password,
      email: Helpers.lowerCase(email),
      uId,
      avatarColor,
      createdAt: new Date()
    } as IAuthDocument
  }

    private userData(data: IAuthDocument, userObjectId: ObjectId): IUserDocument {
    const { _id, username, email, uId, password, avatarColor } = data;
    return {
      _id: userObjectId,
      authId: _id,
      uId,
      username: Helpers.firstLetterUppercase(username),
      email,
      password,
      avatarColor,
      profilePicture: '',
      blocked: [],
      blockedBy: [],
      work: '',
      location: '',
      school: '',
      quote: '',
      bgImageVersion: '',
      bgImageId: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      notifications: {
        messages: true,
        reactions: true,
        comments: true,
        follows: true
      },
      social: {
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: ''
      }
    } as unknown as IUserDocument;
  }

  private signToken(data: IAuthDocument, userObjectId: ObjectId): string {
    return JWT.sign(
      {
        userId: userObjectId,
        uId: data.uId,
        email: data.email,
        username: data.username,
        avatarColor: data.avatarColor,
      },
      config.JWT_TOKEN!
    );
  }
}

export const signup: Signup = new Signup();
