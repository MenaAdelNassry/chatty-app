import mongoose, { Document } from "mongoose";

export interface INotificationDocument extends Document {
  _id: mongoose.Types.ObjectId | string;
  userTo: string | mongoose.Types.ObjectId;
  userFrom: string | mongoose.Types.ObjectId;
  message: string;
  notificationType: string;
  entityId: mongoose.Types.ObjectId;   // Post ID, User ID (in follow)
  createdItemId: mongoose.Types.ObjectId; // Comment ID, Reaction ID
  comment: string;
  reaction: string;
  post: string;
  imgId: string;
  imgVersion: string;
  gifUrl: string;
  read?: boolean;
  createdAt: Date;
  isFollowing?: boolean;
}

export interface INotification {
  userTo: string;
  userFrom: string;
  message: string;
  notificationType: string;
  entityId: mongoose.Types.ObjectId;
  createdItemId: mongoose.Types.ObjectId;
  createdAt: Date;
  comment: string;
  reaction: string;
  post: string;
  imgId: string;
  imgVersion: string;
  gifUrl: string;
}

export interface INotificationJobData {
  key?: string;
  userFrom?: string;
  userTo?: string;
  message?: string;
  notificationType?: notificationType;
  entityId?: string;
  createdItemId?: string;
  createdAt?: Date;
  comment?: string;
  post?: string;
  imgId?: string;
  imgVersion?: string;
  gifUrl?: string;
  reaction?: string;
  deleteBlockInteraction?: boolean;
  userId?: string;
  postId?: string;
}

export interface INotificationTemplate {
  username: string;
  message: string;
  header: string;
}

export type notificationType = "follows" | "comments" | "reactions" | "messages";
