import mongoose, { Document, ObjectId } from 'mongoose';
import { MessageType } from '@chat/interfaces/conversation.interface';

export enum MessageReactionType {
  LIKE = 'like',
  LOVE = 'love',
  HAPPY = 'happy',
  SAD = 'sad',
  WOW = 'wow',
  ANGRY = 'angry'
}

export const MessageReactionValues = Object.values(MessageReactionType);

export interface IChatJobData {
  message?: IMessageData;
  receiverId?: string;
  conversationId?: string;
  reaction?: MessageReactionType;
  messageId?: string;
  senderId?: string;
  type?: string;
  userId?: string;
  isNewConversation?: boolean;
}

export interface IMessageDocument extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;

  // Content
  body: string; // text message
  type: MessageType;

  // Media Details (Optional)
  // Cloudinary URL
  selectedImage?: string;
  gifUrl?: string;
  selectedVideo?: string;
  selectedAudio?: string;

  // Smart Features
  isRead: boolean;
  readAt?: Date;

  // Reactions (Like Facebook: ❤️, 😂, 👍)
  reaction: Array<{
    senderId: mongoose.Types.ObjectId;
    type: MessageReactionType;
  }>;

  // Reply Logic (Context)
  replyTo?: mongoose.Types.ObjectId;

  // Deletion Logic
  isDeleted: boolean; // Soft Delete (They are being removed for everyone)
  deletedFor: Array<string>;

  createdAt: Date;
}

export interface IMessageData {
  _id: string | ObjectId;
  conversationId: mongoose.Types.ObjectId | string; // It might be empty if it's the first message
  senderId: mongoose.Types.ObjectId | string;
  receiverId?: mongoose.Types.ObjectId | string;
  body: string;
  type: MessageType;
  gifUrl?: string;
  selectedImage?: string;
  selectedVideo?: string;
  selectedAudio?: string;
  reaction: Array<{
    senderId: mongoose.Types.ObjectId | string;
    type: MessageReactionType;
  }>;
  deletedFor: Array<string>;
  isDeleted: boolean;
  replyTo?: string | object;
  createdAt: Date | string;
}

export interface IMessageSocketData extends IMessageData {
  senderData?: {
    userId?: string;
    username: string;
    avatarColor: string;
    profilePicture: string;
  };
}
