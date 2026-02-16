import mongoose, { Document } from 'mongoose';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  GIF = 'gif',
  AUDIO = 'audio',
}

export const MessageTypeValues = Object.values(MessageType);

export interface IConversationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[]; // [UserId1, UserId2]

  // 🔥 Performance Optimization:
  lastMessage: string;
  lastMessageId: mongoose.Types.ObjectId;
  lastMessageSenderId: mongoose.Types.ObjectId;
  lastMessageType: MessageType;

  // (Unread Badge)
  // Map: { "userId1": 0, "userId2": 3 }
  unreadCounts: Map<string, number>;
  lastRead: Map<string, string>;
  lastDelivered: Map<string, string>;

  createdAt: Date;
  updatedAt: Date;
}
