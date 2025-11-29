import { IMessageDocument } from '@chat/interfaces/message.interface';
import mongoose, { model, Model, Schema } from 'mongoose';

const reactionProps = {
  senderName: { type: String, default: '' },
  type: { type: String, default: '' }
};

const messageSchema: Schema = new Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderUsername: { type: String, default: '' },
  senderAvatarColor: { type: String, default: '' },
  senderProfilePicture: { type: String, default: '' },
  receiverUsername: { type: String, default: '' },
  receiverAvatarColor: { type: String, default: '' },
  receiverProfilePicture: { type: String, default: '' },
  body: { type: String, default: '' },
  gifUrl: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  deleteForMe: { type: Boolean, default: false },
  deleteForEveryone: { type: Boolean, default: false },
  selectedImage: { type: String, default: '' },
  reaction: [reactionProps],
  createdAt: { type: Date, default: Date.now }
});

const MessageModel: Model<IMessageDocument> = model<IMessageDocument>('Message', messageSchema, 'Message');
export { MessageModel };
