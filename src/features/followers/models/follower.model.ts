import { IFollowerDocument } from '@follower/interfaces/follower.interface';
import mongoose, { Model, Schema, model } from 'mongoose';

const followerSchema: Schema = new Schema({
  followerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  followeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  createdAt: { type: Date, default: Date.now }
});

followerSchema.index({ followerId: 1, followeeId: 1 }, { unique: true })

const FollowerModel: Model<IFollowerDocument> = model<IFollowerDocument>('Follower', followerSchema, 'Follower');
export { FollowerModel };
