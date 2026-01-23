import { IBasicInfo, INotificationSettings, ISearchUser, ISocialLinks, IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import mongoose from 'mongoose';
import { followerService } from './follower.service';
import { AuthModel } from '@auth/models/auth.schema';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { BadRequestError } from '@global/helpers/error-handler';
import { authService } from './auth.service';
import { Helpers } from '@global/helpers/helpers';

class UserService {
  public async addUserToDB(data: IUserDocument): Promise<void> {
    await UserModel.create(data);
  }

  public async getUserByAuthId(authId: string): Promise<IUserDocument> {
    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { authId: new mongoose.Types.ObjectId(authId) } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $project: this.aggregateProject() }
    ]);

    return users[0];
  }

  public async getUserById(userId: string): Promise<IUserDocument> {
    const aggregate: any[] = [
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $project: this.aggregateProject() }
    ];

    const users: IUserDocument[] = await UserModel.aggregate(aggregate);

    return users[0];
  }

  public async countUsersInDB(): Promise<number> {
    const totalCount: number = await UserModel.find({}).countDocuments();
    return totalCount;
  }

  public async removeBackgroundImage(userId: string, imageId: string): Promise<void> {
    await UserModel.updateOne({ _id: userId, bgImageId: imageId }, { $set: { bgImageId: '', bgImageVersion: '' } });
  }

  public async getRandomUsersFromDB(excludeIds: string[]): Promise<IUserDocument[]> {
    const users: IUserDocument[] = await UserModel.aggregate([
      // 1. Filter Out Excluded IDs ($nin = Not In)
      {
        $match: {
          _id: {
            $nin: excludeIds.map((id) => new mongoose.Types.ObjectId(id)) // Convert Strings to ObjectIds
          }
        }
      },
      // 2. Random Sampling (Select 12 random users)
      { $sample: { size: 12 } },
      // 3. Hide Sensitive Data (Privacy)
      { $project: this.aggregateProject() }
    ]);

    return users;
  }

  public async updatePassword(username: string, newPassword: string, currentPassword: string): Promise<void> {
    const existingUser: IAuthDocument = await authService.getAuthUserByUsername(username);
    if (!existingUser) {
      throw new BadRequestError('User not found');
    }

    const isPasswordsMatch: boolean = await existingUser.comparePassword(currentPassword);
    if (!isPasswordsMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    const newHashedPassword: string = await existingUser.hashPassword(newPassword);

    await AuthModel.updateOne({ _id: existingUser._id }, { $set: { password: newHashedPassword }, $inc: { tokenVersion: 1 } });
  }

  public async updateUserInfo(userId: string, info: IBasicInfo): Promise<void> {
    const { quote, work, school, location } = info;

    const updateFields: Partial<IBasicInfo> = {};

    if (quote !== undefined) updateFields.quote = quote;
    if (work !== undefined) updateFields.work = work;
    if (school !== undefined) updateFields.school = school;
    if (location !== undefined) updateFields.location = location;

    await UserModel.updateOne({ _id: userId }, { $set: updateFields });
  }

  public async updateSocialLinks(userId: string, socialLinks: ISocialLinks): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: { social: socialLinks }
      }
    );
  }

  public async updateNotificationSettings(userId: string, settings: INotificationSettings): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $set: { notifications: settings } });
  }

  public async searchUsers(
    query: string,
    excludeIds: string[],
    requestUserId: string,
    skip: number,
    limit: number
  ): Promise<ISearchUser[]> {
    const regex = new RegExp(Helpers.escapeRegex(query), 'i');
    const startWithRegex = new RegExp(`^${Helpers.escapeRegex(query)}`, 'i'); 

    const myObjectId = new mongoose.Types.ObjectId(requestUserId);

    const users: ISearchUser[] = await UserModel.aggregate([
      // Stage 1: Lookup Auth
      {
        $lookup: {
          from: 'Auth',
          localField: 'authId',
          foreignField: '_id',
          as: 'authId'
        }
      },
      { $unwind: '$authId' },

      // Stage 2: Match
      {
        $match: {
          'authId.username': { $regex: regex },
          _id: { $nin: excludeIds.map((id) => new mongoose.Types.ObjectId(id)) }
        }
      },

      // 🔥 Stage 3: Add Scoring Field
      {
        $addFields: {
          isStartsWith: {
            $regexMatch: {
              input: '$authId.username',
              regex: startWithRegex
            }
          }
        }
      },

      // 🔥 Stage 4: Smart Sort
      {
        $sort: {
          isStartsWith: -1,
          followersCount: -1,
          _id: 1
        }
      },

      // Stage 5: Pagination
      { $skip: skip },
      { $limit: limit },

      // Stage 6: Lookup Following
      {
        $lookup: {
          from: 'Follower',
          let: { targetUserId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$followerId', myObjectId] }, { $eq: ['$followeeId', '$$targetUserId'] }]
                }
              }
            }
          ],
          as: 'isFollowingDoc'
        }
      },

      // Stage 7: Project
      {
        $project: {
          _id: 1,
          profilePicture: 1,
          username: '$authId.username',
          uId: '$authId.uId',
          avatarColor: '$authId.avatarColor',
          following: { $gt: [{ $size: '$isFollowingDoc' }, 0] }
        }
      }
    ]);

    return users;
  }

  private aggregateProject() {
    return {
      _id: 1,
      username: '$authId.username',
      uId: '$authId.uId',
      email: '$authId.email',
      avatarColor: '$authId.avatarColor',
      createdAt: '$authId.createdAt',
      postsCount: 1,
      work: 1,
      school: 1,
      quote: 1,
      location: 1,
      followersCount: 1,
      followingCount: 1,
      notifications: 1,
      social: 1,
      bgImageVersion: 1,
      bgImageId: 1,
      profilePicture: 1
    };
  }
}

export const userService: UserService = new UserService();
