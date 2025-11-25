import { Response } from 'express';
import { IFileImageDocument } from '@image/interfaces/image.interface';
import { AuthPayload } from '@auth/interfaces/auth.interface';
import mongoose from 'mongoose';

export interface IImageBody {
  image?: string;
  imgId?: string;
  imgVersion?: string;
}

export interface IParams {
  imageId?: string;
  bgImageId?: string;
  userId?: string;
}

export const imageMockRequest = (
  body: IImageBody,
  currentUser?: AuthPayload | null,
  params?: IParams
) => ({
  body,
  params,
  currentUser
});

export const imageMockResponse = (): Response => {
  const res: Response = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

export const mockImageDocument: IFileImageDocument = {
  _id: new mongoose.Types.ObjectId('60263f14648fed5246e322d9'),
  userId: new mongoose.Types.ObjectId('60263f14648fed5246e322d8'),
  publicId: 'sample_image_id',
  version: '12345678',
  type: 'profile', // أو 'background'
  createdAt: new Date()
} as unknown as IFileImageDocument;
