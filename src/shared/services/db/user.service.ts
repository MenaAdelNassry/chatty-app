import { IBasicInfo, INotificationSettings, ISearchUser, ISocialLinks, IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import mongoose from 'mongoose';
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

  public async getUserById(userId: string, viewerId?: string): Promise<IUserDocument> {
    const aggregate: any[] = [
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' }
    ];

    if (viewerId) {
      const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
      aggregate.push(
        {
          $lookup: {
            from: 'Follower',
            let: { targetUserId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$followerId', viewerObjectId] }, { $eq: ['$followeeId', '$$targetUserId'] }]
                  }
                }
              }
            ],
            as: 'isFollowingDoc'
          }
        },
        {
          $addFields: {
            isFollowing: { $gt: [{ $size: '$isFollowingDoc' }, 0] }
          }
        }
      );
    }

    aggregate.push({ $project: this.aggregateProject(!!viewerId) });

    const users: IUserDocument[] = await UserModel.aggregate(aggregate);
    return users[0];
  }

  public async countUsersInDB(): Promise<number> {
    const totalCount: number = await UserModel.countDocuments({
      freezedAt: null,
      emailVerified: true
    });

    return totalCount;
  }

  public async removeBackgroundImage(userId: string, imageId: string): Promise<void> {
    await UserModel.updateOne({ _id: userId, bgImageId: imageId }, { $set: { bgImageId: '', bgImageVersion: '' } });
  }

  public async getRandomUsersFromDB(excludeIds: string[], myFollowingIds: string[]): Promise<IUserDocument[]> {
    const myFollowingObjectIds = myFollowingIds.map((id) => new mongoose.Types.ObjectId(id));

    const users: IUserDocument[] = await UserModel.aggregate([
      // 1. Match & Sample
      { $match: { _id: { $nin: excludeIds.map((id) => new mongoose.Types.ObjectId(id)) }, freezedAt: null, emailVerified: true } },
      { $sample: { size: 20 } },

      // 2. Lookup Auth
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },

      // 🔥 3. Smart Mutual Followers Logic (using $facet) 🔥
      {
        $lookup: {
          from: 'Follower',
          let: { candidateId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$followeeId', '$$candidateId'] }, { $in: ['$followerId', myFollowingObjectIds] }]
                }
              }
            },
            // facet
            {
              $facet: {
                count: [{ $count: 'total' }],
                samples: [
                  { $limit: 2 },
                  { $lookup: { from: 'User', localField: 'followerId', foreignField: '_id', as: 'user' } },
                  { $unwind: '$user' },
                  { $lookup: { from: 'Auth', localField: 'user.authId', foreignField: '_id', as: 'auth' } },
                  { $unwind: '$auth' },
                  {
                    $project: {
                      _id: '$user._id',
                      username: '$auth.username',
                      avatarColor: '$auth.avatarColor',
                      profilePicture: '$user.profilePicture'
                    }
                  }
                ]
              }
            }
          ],
          as: 'mutualData'
        }
      },

      // 4. Unwind & Format
      { $unwind: '$mutualData' },

      {
        $addFields: {
          mutualFollowers: '$mutualData.samples',
          mutualFollowersCount: {
            $ifNull: [{ $arrayElemAt: ['$mutualData.count.total', 0] }, 0]
          }
        }
      },

      // 5. Project Final Shape
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
  ): Promise<{ users: ISearchUser[]; total: number }> {
    const regex = new RegExp(Helpers.escapeRegex(query), 'i');
    const startWithRegex = new RegExp(`^${Helpers.escapeRegex(query)}`, 'i');
    const myObjectId = new mongoose.Types.ObjectId(requestUserId);

    const result = await UserModel.aggregate([
      // Stage 1: Pre-Filter
      {
        $match: {
          _id: { $nin: excludeIds.map((id) => new mongoose.Types.ObjectId(id)) },
          freezedAt: null,
          emailVerified: true
        }
      },

      // Stage 2: Lookup Auth
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },

      // Stage 3: Match Username
      { $match: { 'authId.username': { $regex: regex } } },

      // Stage 4: Scoring (Add isStartsWith)
      {
        $addFields: {
          isStartsWith: { $regexMatch: { input: '$authId.username', regex: startWithRegex } }
        }
      },

      {
        $facet: {
          // (users)
          users: [
            { $sort: { isStartsWith: -1, followersCount: -1, _id: 1 } },
            { $skip: skip },
            { $limit: limit },
            // Following Check Logic
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
            // Project Data
            {
              $project: {
                _id: 1,
                profilePicture: 1,
                username: '$authId.username',
                followersCount: 1,
                uId: '$authId.uId',
                avatarColor: '$authId.avatarColor',
                following: { $gt: [{ $size: '$isFollowingDoc' }, 0] } // ✅ Following Logic
              }
            }
          ],

          total: [{ $count: 'count' }]
        }
      }
    ]);

    const finalResult = result[0];

    return {
      users: finalResult.users,
      total: finalResult.total[0] ? finalResult.total[0].count : 0
    };
  }

  public async freezeAccount(userId: string, authId: string, freezedBy: string): Promise<void> {
    // 1. Start Session (Transaction)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Update User Document (Set freeze info)
      await UserModel.updateOne(
        { _id: userId },
        {
          $set: {
            freezedAt: new Date(),
            freezedBy: new mongoose.Types.ObjectId(freezedBy),
            restoredAt: null,
            restoredBy: null
          }
        },
        { session }
      );

      // 3. Update Auth Document (Invalidate Tokens)
      await AuthModel.updateOne({ _id: authId }, { $inc: { tokenVersion: 1 } }, { session });

      // 4. Commit Transaction (Save changes)
      await session.commitTransaction();
    } catch (error) {
      // 5. Rollback on Error
      await session.abortTransaction();
      throw error;
    } finally {
      // 6. End Session
      session.endSession();
    }
  }

  public async unfreezeUser(userId: string, restoredBy: string): Promise<void> {
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          freezedAt: null,
          freezedBy: null,
          restoredAt: new Date(),
          restoredBy: new mongoose.Types.ObjectId(restoredBy)
        }
      }
    );
  }

  private aggregateProject(includeFollowing: boolean = false) {
    // Default value is false
    const project: any = {
      _id: 1,
      username: '$authId.username',
      uId: '$authId.uId',
      email: '$authId.email',
      avatarColor: '$authId.avatarColor',
      createdAt: '$authId.createdAt',
      authId: '$authId._id',
      tokenVersion: '$authId.tokenVersion',

      mutualFollowers: 1,
      mutualFollowersCount: 1
    };

    if (includeFollowing) {
      project['isFollowing'] = 1;
    }

    for (const key in UserModel.schema.paths) {
      if (key !== '__v' && key !== 'authId' && key !== '_id' && key !== 'createdAt') {
        project[key] = 1;
      }
    }
    return project;
  }
}

export const userService: UserService = new UserService();
