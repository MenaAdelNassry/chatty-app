import mongoose from 'mongoose';

export type imageTypes = "profile" | "background" | "post";

export interface IFileImageDocument extends mongoose.Document {
  _id: string | mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | string;
  version: string;
  publicId: string;
  type: imageTypes;
  createdAt: Date;
}

export interface IFileImageJobData {
  key?: string;
  value?: string;
  publicId?: string;
  version?: string;
  userId?: string;
  imageId?: string;
  type?: imageTypes;
}

export interface IBgUploadResponse {
  version: string;
  publicId: string;
  public_id?: string;
}
