import { IConversationDocument, MessageType, MessageTypeValues } from '@chat/interfaces/conversation.interface';
import mongoose from 'mongoose';

const conversationSchema: mongoose.Schema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: '' },
    groupAvatar: { type: String, default: '' },
    groupAdminIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: String, default: '' },
    lastMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessageType: {
      type: String,
      enum: MessageTypeValues,
      default: MessageType.TEXT
    },

    // Unread Count Logic (Key-Value Pair)
    unreadCounts: { type: Map, of: Number, default: {} },
    totalMessages: { type: Number, default: 0 },
    lastRead: {
      type: Map,
      of: mongoose.Schema.Types.ObjectId, // ex:) userA: messageId120,
      default: {}
    },
    lastDelivered: { type: Map, of: mongoose.Schema.Types.ObjectId, default: {} }
  },
  {
    timestamps: true
  }
);

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 }); // To sort by newest

export const ConversationModel = mongoose.model<IConversationDocument>('Conversation', conversationSchema, 'Conversation');
