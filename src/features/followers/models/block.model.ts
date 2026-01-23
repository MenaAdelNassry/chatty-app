import { IBlockDocument } from "@follower/interfaces/follower.interface";
import mongoose, { Model, model, Schema } from "mongoose";

const blockSchema: Schema = new Schema({
  blockerId: { type: mongoose.Types.ObjectId, ref: "User", index: true },
  blockedId: { type: mongoose.Types.ObjectId, ref: "User", index: true },
  createdAt: { type: Date, default: Date.now }
});

// Compound Index
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export const BlockModel: Model<IBlockDocument> = model<IBlockDocument>("Block", blockSchema, "Block");
