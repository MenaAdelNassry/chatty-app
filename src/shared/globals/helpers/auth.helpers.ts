import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { IUserDocument, UserRole } from '@user/interfaces/user.interface';
import { ObjectId } from 'mongodb';
import { Helpers } from '@global/helpers/helpers';
import { UserCache } from '@service/redis/user.cache';
import { authQueue } from '@service/queues/auth.queue';
import { userQueue } from '@service/queues/user.queue';
import { omit } from 'lodash';
import { UploadApiResponse } from 'cloudinary';
import { uploadToCloudinary } from './cloudinary-upload';
import { config } from '@root/config';
import { imageQueue } from '@service/queues/image.queue';

const userCache: UserCache = new UserCache();

export class AuthHelper {
  public static async createAndSaveUser(authData: IAuthDocument, userObjectId: ObjectId, photoUrl: string): Promise<IUserDocument> {
    // 1. Prepare User Document
    const userData: IUserDocument = {
      _id: userObjectId,
      authId: `${authData._id}`,
      uId: authData.uId,
      username: Helpers.firstLetterUppercase(authData.username),
      email: authData.email,
      password: authData.password,
      avatarColor: authData.avatarColor,
      profilePicture: photoUrl,
      role: UserRole.USER,
      emailVerified: authData.emailVerified,
      createdAt: new Date(),
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      tokenVersion: authData.tokenVersion || 0,
      notifications: { messages: true, reactions: true, comments: true, follows: true },
      social: { facebook: '', instagram: '', twitter: '', youtube: '' },
      work: '',
      location: '',
      school: '',
      quote: '',
      bgImageVersion: '',
      bgImageId: ''
    } as unknown as IUserDocument;

    // 2. Save to Redis
    await userCache.saveUserToCache(`${userObjectId}`, authData.uId, userData);

    // 3. Save to DB (Queues)
    const dataForUserQueue: IUserDocument = omit(userData, ['uId', 'username', 'email', 'avatarColor', 'password']);

    authQueue.addAuthUserJob('addAuthUserToDB', { value: authData });
    userQueue.addUserJob('addUserToDB', { value: dataForUserQueue });

    return userData;
  }

  public static async uploadUserProfileImage(image: string, userObjectId: ObjectId): Promise<string> {
    if (!image) return '';

    const result: UploadApiResponse = await uploadToCloudinary(image, {
      public_id: `${userObjectId}`,
      overwrite: true,
      invalidate: true
    });

    const url = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${userObjectId}`;

    imageQueue.addImageJob('addUserProfileImageToDB', {
      key: `${userObjectId}`,
      value: url,
      publicId: result.public_id,
      version: result.version.toString(),
      newImage: true
    });

    return url;
  }
}
