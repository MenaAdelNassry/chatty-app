import { uploads } from '@global/helpers/cloudinary-upload';
import { BadRequestError, joiRequestValidationError } from '@global/helpers/error-handler';
import { addImageSchema } from '@image/schemes/images';
import { UploadApiResponse } from 'cloudinary';
import { Request, Response } from 'express';
import { config } from '@root/config';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UserCache } from '@service/redis/user.cache';
import { socketIOImageObject } from '@socket/image';
import { imageQueue } from '@service/queues/image.queue';
import HTTP_STATUS from 'http-status-codes';
import { userService } from '@service/db/user.service';
import { IBgUploadResponse } from '@image/interfaces/image.interface';
import { Helpers } from '@global/helpers/helpers';
import { imageService } from '@service/db/image.service';

const userCache: UserCache = new UserCache();

class Add {
  // -------------------------------------------------------------------------
  // TODO: ⚠️ IMAGE HISTORY LOSS (Technical Debt)
  //
  // Current Logic:
  // We use `req.currentUser.userId` as the 'public_id' for Cloudinary uploads
  // with `overwrite: true`.
  //
  // Problem:
  // This overwrites the previous profile picture on Cloudinary.
  // Even though we save a new document in the Image Collection (MongoDB),
  // ALL previous profile image records in the DB will point to the NEW image
  // (because they share the same public_id). The history is effectively lost.
  //
  // FUTURE FIX:
  // Use a unique public_id for every upload (e.g., `${userId}_${Date.now()}`).
  // This will preserve the history of profile pictures in the Gallery.
  // -------------------------------------------------------------------------
  public profileImage = async (req: Request, res: Response): Promise<void> => {
    // -------------------------------------------------------------------------
    // 1. VALIDATION
    // Check if the request body contains a valid base64 image string.
    // -------------------------------------------------------------------------
    const { value, error } = addImageSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // -------------------------------------------------------------------------
    // 2. CLOUDINARY UPLOAD
    // Upload the image to Cloudinary.
    // We use the 'userId' as the public_id to ensure the user always has ONE
    // consistent profile image ID (overwriting the old one).
    // -------------------------------------------------------------------------
    const { image } = value;
    const result: UploadApiResponse = (await uploads(image, req.currentUser!.userId, true, true)) as UploadApiResponse;
    if (!result?.public_id) {
      throw new BadRequestError('File upload: Error corrupted. Try again.');
    }

    // -------------------------------------------------------------------------
    // 3. URL CONSTRUCTION
    // Build the new image URL using the version returned from Cloudinary.
    // -------------------------------------------------------------------------
    const url = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${req.currentUser!.userId}`;

    // -------------------------------------------------------------------------
    // 4. CACHE UPDATE (With Fallback Strategy)
    // Try to update the 'profilePicture' field in Redis.
    // If the user is not in the cache (null), fetch the full user from MongoDB
    // and manually update the profile picture property for the response/socket.
    // -------------------------------------------------------------------------
    let cachedUser: IUserDocument | null = await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      profilePicture: url
    });
    if (!cachedUser) {
      cachedUser = await userService.getUserById(req.currentUser!.userId);
      // Manually update the returned object to reflect the new image immediately
      if (cachedUser) {
        cachedUser.profilePicture = url;
      }
    }

    // -------------------------------------------------------------------------
    // 5. SOCKET IO EMIT
    // Notify the frontend to update the UI immediately without refreshing.
    // -------------------------------------------------------------------------
    socketIOImageObject.emit('update user', cachedUser);

    // -------------------------------------------------------------------------
    // 6. BACKGROUND JOB (Queue)
    // Add a job to the queue to persist changes in MongoDB:
    // - Update User Model (profilePicture field).
    // - Create a new document in Image Model (for the gallery history).
    // -------------------------------------------------------------------------
    imageQueue.addImageJob('addUserProfileImageToDB', {
      key: req.currentUser!.userId,
      value: url,
      publicId: result.public_id,
      version: result.version.toString()
    });

    // -------------------------------------------------------------------------
    // 7. RESPONSE
    // -------------------------------------------------------------------------
    res.status(HTTP_STATUS.OK).json({ message: 'Image added successfully' });
  };

  public backgroundImage = async (req: Request, res: Response): Promise<void> => {
    // -------------------------------------------------------------------------
    // 1. VALIDATION
    // Validate the request body to ensure the image string is provided.
    // -------------------------------------------------------------------------
    const { value, error } = addImageSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // -------------------------------------------------------------------------
    // 2. IMAGE UPLOAD / PARSING
    // Determine if the image is new (Base64) or existing (URL).
    // If Base64 -> Upload to Cloudinary and get new ID/Version.
    // If URL -> Parse the URL to extract ID/Version.
    // -------------------------------------------------------------------------
    const { image } = value;
    const { version, publicId }: IBgUploadResponse = await this.backgroundUpload(image);

    // -------------------------------------------------------------------------
    // 3. CACHE UPDATE (With Fallback Strategy)
    // Update 'bgImageId' and 'bgImageVersion' in Redis.
    // Fallback: If cache is empty (null), fetch user from DB and manually
    // update the fields in the retrieved object for the response.
    // -------------------------------------------------------------------------
    let response: IUserDocument | null = await userCache.updateUserItemsInCache(req.currentUser!.userId, {
      bgImageId: publicId,
      bgImageVersion: version
    });

    if (!response) {
      response = await userService.getUserById(req.currentUser!.userId);
      response.bgImageId = publicId;
      response.bgImageVersion = version;
    }

    // -------------------------------------------------------------------------
    // 4. SOCKET IO EMIT
    // Notify frontend with the full updated user object.
    // -------------------------------------------------------------------------
    socketIOImageObject.emit('update user', response);

    // -------------------------------------------------------------------------
    // 5. BACKGROUND JOB (Queue)
    // Add job to persist changes in MongoDB (User Collection & Image Collection).
    // -------------------------------------------------------------------------
    imageQueue.addImageJob('addBackgroundImageToDB', {
      key: req.currentUser!.userId,
      publicId,
      version
    });

    // -------------------------------------------------------------------------
    // 6. RESPONSE
    // -------------------------------------------------------------------------
    res.status(HTTP_STATUS.OK).json({ message: 'Image added successfully' });
  };

  private backgroundUpload = async (image: string): Promise<IBgUploadResponse> => {
    const isBase64 = Helpers.isBase64(image);
    let version = '';
    let publicId = '';

    if (isBase64) {
      const result: UploadApiResponse = (await uploads(image)) as UploadApiResponse;
      if (!result?.public_id) {
        throw new BadRequestError('File upload: Error corrupted. Try again.');
      }

      version = result.version.toString();
      publicId = result.public_id;
    } else {
      // -------------------------------------------------------------------------
      // TODO: ⚠️ FRAGILE URL PARSING (Bug Risk)
      //
      // Current Logic:
      // We extract 'version' and 'publicId' by splitting the URL string.
      //
      // Problem:
      // This logic breaks if the Cloudinary URL structure changes (e.g., using folders).
      // Relying on array indices [length-1] and [length-2] is risky.
      //
      // FUTURE FIX:
      // The frontend should send 'bgImageId' and 'bgImageVersion' explicitly
      // in the request body when reusing an existing image, instead of sending the full URL.
      // -------------------------------------------------------------------------
      const value = image.split('/');
      version = value[value.length - 2].slice(1);
      publicId = value[value.length - 1];
    }

    return { publicId, version };
  };
}

export const add: Add = new Add();
