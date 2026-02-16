import { MessageType, MessageTypeValues } from '@chat/interfaces/conversation.interface';
import { IMessageDocument, MessageReactionValues } from '@chat/interfaces/message.interface';
import mongoose from 'mongoose';

const messageSchema: mongoose.Schema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    body: { type: String, default: '' },
    type: { type: String, enum: MessageTypeValues, default: MessageType.TEXT },

    selectedImage: { type: String, default: '' },
    selectedVideo: { type: String, default: '' },
    selectedAudio: { type: String, default: '' },
    gifUrl: { type: String, default: '' },

    reaction: [
      {
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        type: { type: String, enum: MessageReactionValues, required: true }
      }
    ],

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },

    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: true
  }
);

// Indexes
messageSchema.index({ conversationId: 1, createdAt: -1 });


export const MessageModel = mongoose.model<IMessageDocument>('Message', messageSchema, 'Message');
