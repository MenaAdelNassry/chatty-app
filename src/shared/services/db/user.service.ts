import { IBasicInfo, INotificationSettings, ISearchUser, ISocialLinks, IUserDocument } from '@user/interfaces/user.interface';
import { UserModel } from '@user/models/user.schema';
import mongoose from 'mongoose';
import { followerService } from './follower.service';
import { AuthModel } from '@auth/models/auth.schema';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { BadRequestError } from '@global/helpers/error-handler';
import { authService } from './auth.service';
import { INotification } from '@notification/interfaces/notification.interface';

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
    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $project: this.aggregateProject() }
    ]);

    return users[0];
  }

  // -------------------------------------------------------------------------
  // TODO: ⚠️ CRITICAL LOGIC BUG (Non-Deterministic Pagination)
  //
  // Current Implementation:
  // We are applying `$skip` and `$limit` BEFORE `$sort`.
  //
  // The Problem (Why this breaks):
  // MongoDB retrieves the first `limit` documents based on "Natural Order" (disk storage order),
  // which is effectively random. We then sort ONLY that small random chunk.
  //
  // Expected Failure Scenario (How to verify):
  // 1. Create 20 users with different `createdAt` dates.
  // 2. Request Page 1 (limit 10). You get a random set of 10, sorted.
  // 3. Request Page 2. You might get some users from Page 1 again, or miss users entirely.
  // 4. The result is NOT "The latest users globally", but "The latest users from a random bucket".
  //
  // FIX:
  // Move `{ $sort: { createdAt: -1 } }` to be the SECOND stage (immediately after $match).
  // This forces DB to sort the entire collection first, guaranteeing stable pagination.
  // -------------------------------------------------------------------------
  public async getAllUsers(excludedUserId: string, skip: number, limit: number): Promise<IUserDocument[]> {
    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(excludedUserId) } } },
      { $skip: skip },
      { $limit: limit },
      { $sort: { createdAt: -1 } }, // <--- This line is in the wrong place
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      { $project: this.aggregateProject() }
    ]);

    return users;
  }

  // -------------------------------------------------------------------------
  // NOTE For LEARNING 🧠 : estimatedDocumentCount() vs countDocuments()
  //
  // 1. countDocuments({}) -> O(N) Slow & Accurate
  //    It performs a collection scan (or index scan), counting documents one by one.
  //    On large datasets (millions), this can take seconds and consume CPU.
  //
  // 2. estimatedDocumentCount() -> O(1) Fast & Approximate
  //    It does NOT count documents. Instead, it retrieves the collection's metadata
  //    statistics stored internally by MongoDB. It is instantaneous.
  //
  // Trade-off:
  // It might be slightly inaccurate if the server crashed recently or in sharded clusters
  // (unclean shutdown might lead to metadata drift). However, for UI counters like
  // "Total Users", the speed benefit vastly outweighs the rare risk of being off by a few digits.
  // -------------------------------------------------------------------------
  public async countUsersInDB(): Promise<number> {
    const totalCount: number = await UserModel.find({}).countDocuments();
    return totalCount;
  }

  public async removeBackgroundImage(userId: string, imageId: string): Promise<void> {
    await UserModel.updateOne({ _id: userId, bgImageId: imageId }, { $set: { bgImageId: '', bgImageVersion: '' } });
  }

  public async getRandomUsersFromDB(myId: string): Promise<IUserDocument[]> {
    const BATCH_SIZE = 50;
    const TARGET_SIZE = 10;

    const randomDocs = await UserModel.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(myId) } } },
      { $sample: { size: BATCH_SIZE } },
      { $project: { _id: 1 } }
    ]);

    const followeesIDs: string[] = await followerService.getFolloweeIds(myId);
    const followeesSet = new Set(followeesIDs);

    const filteredIds: mongoose.Types.ObjectId[] = [];

    for (const doc of randomDocs) {
      if (!followeesSet.has(doc._id.toString())) {
        filteredIds.push(doc._id);
      }
      if (filteredIds.length === TARGET_SIZE) break;
    }

    const users: IUserDocument[] = await UserModel.aggregate([
      { $match: { _id: { $in: filteredIds } } },
      { $lookup: { from: 'Auth', localField: 'authId', foreignField: '_id', as: 'authId' } },
      { $unwind: '$authId' },
      {
        $addFields: {
          username: '$authId.username',
          email: '$authId.email',
          avatarColor: '$authId.avatarColor',
          uId: '$authId.uId',
          createdAt: '$authId.createdAt'
        }
      },
      {
        $project: { authId: 0, __v: 0 }
      }
    ]);

    return users;
  }

  public async searchUsers(regex: RegExp): Promise<ISearchUser[]> {
    const users: ISearchUser[] = await AuthModel.aggregate([
      { $match: { username: regex } },
      { $lookup: { from: 'User', localField: '_id', foreignField: 'authId', as: 'user' } },
      { $unwind: '$user' },
      {
        $project: {
          _id: '$user._id',
          profilePicture: '$user.profilePicture',
          username: 1,
          email: 1,
          avatarColor: 1
        }
      }
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

    await AuthModel.updateOne({ _id: existingUser._id }, { password: newHashedPassword });
  }

  public async updateUserInfo(userId: string, info: IBasicInfo): Promise<void> {
    const { quote, work, school, location } = info;

    await UserModel.updateOne(
      { _id: userId },
      {
        $set: { quote, work, school, location }
      }
    );
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
    await UserModel.updateOne(
      { _id: userId },
      { $set: { notifications: settings } }
    );
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
      blocked: 1,
      blockedBy: 1,
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
