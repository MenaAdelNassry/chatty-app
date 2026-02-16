import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';
import { IUserDocument, UserRole } from '@user/interfaces/user.interface';

declare global {
  namespace Express {
    interface Request {
      currentUser?: AuthPayload;
    }
  }
}

export interface AuthPayload {
  userId: string;
  uId: string;
  email: string;
  username: string;
  avatarColor: string;
  iat?: number;
  profilePicture: string;
  tokenVersion?: number;
  role: UserRole;
  emailVerified?: boolean;
}

export interface IAuthDocument extends Document {
  _id: string | ObjectId;
  uId: string;
  username: string;
  email: string;
  password?: string;
  avatarColor: string;
  createdAt: Date;
  tokenVersion?: number;
  emailVerified?: boolean;
  googleId?: string;
  comparePassword(password: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

export interface ISignUpData {
  _id: ObjectId;
  uId: string;
  email: string;
  username: string;
  password: string;
  avatarColor: string;

}

export interface IAuthJob {
  value?: string | IAuthDocument | IUserDocument;
}
