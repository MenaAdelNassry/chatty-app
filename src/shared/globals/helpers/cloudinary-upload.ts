import cloudinary, { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { ServerError } from './error-handler';

type uploadOptions = {
  public_id?: string;
  invalidate?: boolean;
  overwrite?: boolean;
  resource_type?: 'image'|'video'|'raw'|'auto';
  chunk_size?: number;
}

export async function uploadToCloudinary(file: string, options: uploadOptions = {}): Promise<UploadApiResponse> {
  try {
    const result: UploadApiResponse = await cloudinary.v2.uploader.upload(file, {
      resource_type: options.resource_type || 'image',
      public_id: options.public_id,
      invalidate: options.invalidate,
      overwrite: options.overwrite,
      chunk_size: options.chunk_size,
    });

    return result;
  } catch (err) {
    const cloudinaryError = err as UploadApiErrorResponse;
    throw new ServerError(cloudinaryError.message || 'Cloudinary upload error');
  }
}

export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<any> {
  try {
    const result = await cloudinary.v2.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: resourceType
    });

    return result;
  } catch (error) {
    const cloudinaryError = error as UploadApiErrorResponse;
    throw new ServerError(cloudinaryError.message || "Cloudinary delete error");
  }
}
