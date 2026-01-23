import { IFileImageDocument } from '@image/interfaces/image.interface';
import mongoose, { model, Model, Schema } from 'mongoose';

const imageSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  version: { type: String, default: '' },
  publicId: { type: String, default: '' },
  type: {
    type: String,
    enum: ['profile', 'background', 'post'],
    default: 'profile'
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

const ImageModel: Model<IFileImageDocument> = model<IFileImageDocument>('Image', imageSchema, 'Image');
export { ImageModel };
