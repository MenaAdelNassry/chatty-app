import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export interface IUserDocument extends Document {
  _id: string | ObjectId;
  authId: string | ObjectId;
  username?: string;
  email?: string;
  password?: string;
  avatarColor?: string;
  uId?: string;
  emailVerified?: boolean;
  postsCount: number;
  work: string;
  school: string;
  quote: string;
  location: string;
  followersCount: number;
  followingCount: number;
  notifications: INotificationSettings;
  social: ISocialLinks;
  bgImageVersion: string;
  bgImageId: string;
  profilePicture: string;
  createdAt?: Date;
  tokenVersion?: number;
  isFollowing?: boolean;

  role: UserRole;
  freezedAt?: Date;
  freezedBy?: string | ObjectId; // (User ID or Admin ID)

  restoredAt?: Date;
  restoredBy?: string | ObjectId;
}

export interface IResetPasswordParams {
  username: string;
  email: string;
  ipaddress: string;
  date: string;
}

export interface INotificationSettings {
  messages: boolean;
  reactions: boolean;
  comments: boolean;
  follows: boolean;
}

export interface IBasicInfo {
  quote: string;
  work: string;
  school: string;
  location: string;
}

export interface ISocialLinks {
  facebook: string;
  instagram: string;
  twitter: string;
  youtube: string;
}

export interface ISearchUser {
  _id: string;
  profilePicture: string;
  username: string;
  following: boolean;
  avatarColor: string;
  followersCount: number;
}

export interface ISocketData {
  blockedUser: string;
  blockedBy: string;
}

export interface ILogin {
  userId: string;
}

export interface IUserJobInfo {
  key?: string;
  value?: string | ISocialLinks;
}

export interface IUserJob {
  key?: string;
  value?: string | INotificationSettings | IUserDocument;
  authId?: string;
  freezedBy?: string;
  type?: string;
  restoredBy?: string;
}

export interface IEmailJob {
  receiverEmail: string;
  subject: string;
  username: string;
  ip?: string;
  otp?: string;
  TTL?: number;
  message?: string;
  header?: string;
  type?: string;
}

export interface IAllUsers {
  users: IUserDocument[];
  totalUsers: number;
}
