import cloudinary, { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { ServerError } from './error-handler';

// export function uploads(
//   file: string,
//   public_id?: string,
//   overwrite?: boolean,
//   invalidate?: boolean
// ): Promise<UploadApiErrorResponse | UploadApiResponse | undefined> {
//   return new Promise((resolve) => {
//     cloudinary.v2.uploader.upload(
//       file,
//       {
//         public_id,
//         overwrite,
//         invalidate,
//       },
//       (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
//         if(error) {
//           resolve(error);
//         } else {
//           resolve(result);
//         }
//       }
//     )
//   })
// }

// export function videoUpload(
//   file: string,
//   public_id?: string,
//   overwrite?: boolean,
//   invalidate?: boolean,
// ): Promise<UploadApiErrorResponse | UploadApiResponse | undefined> {
//   return new Promise((resolve) => {
//     cloudinary.v2.uploader.upload(
//       file,
//       {
//         resource_type: 'video',
//         public_id,
//         overwrite,
//         invalidate,
//       },
//       (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
//         if(error) resolve(error);
//         resolve(result);
//       }
//     );
//   });
// }

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
