import { IConversationDocument } from "@chat/interfaces/conversation.interface";
import mongoose, { model, Model, Schema } from "mongoose";

const conversationSchema: Schema = new Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

conversationSchema.index({ senderId: 1, receiverId: 1 });

const ConversationModel: Model<IConversationDocument> = model<IConversationDocument>("Conversation", conversationSchema, "Conversation");
export { ConversationModel };
