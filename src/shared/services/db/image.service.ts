import { IFileImageDocument, imageTypes } from '@image/interfaces/image.interface';
import { ImageModel } from '@image/models/image.schema';
import { UserModel } from '@user/models/user.schema';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '@global/helpers/error-handler';
import { IUserDocument } from '@user/interfaces/user.interface';

class ImageService {
  // 1. Profile Image
  public async addUserProfileImageToDB(userId: string, imgVersion: string, imgId: string, url: string, newImage: boolean): Promise<void> {
    const updateProfileInUserDoc = UserModel.updateOne({ _id: userId }, { $set: { profilePicture: url } });
    let updateProfileInImageDoc;

    if(newImage) {
      updateProfileInImageDoc = this.addImage(userId, imgVersion, imgId, 'profile');
    }
    await Promise.all([updateProfileInImageDoc, updateProfileInUserDoc]);
  }

  // 2. Background Image
  public async addBackgroundImageToDB(userId: string, imgVersion: string, imgId: string, newImage: boolean): Promise<void> {
    const updateBgInUserDoc = UserModel.updateOne({ _id: userId }, { $set: { bgImageId: imgId, bgImageVersion: imgVersion } });
    let updateBgInImageDoc;
    
    if(newImage) {
      updateBgInImageDoc = this.addImage(userId, imgVersion, imgId, 'background');
    }
    await Promise.all([updateBgInUserDoc, updateBgInImageDoc]);
  }

  // 3. Helper: Create Image Document
  public async addImage(
    userId: string,
    imgVersion: string,
    imgId: string,
    type: imageTypes,
    postId: string | null = null
  ): Promise<IFileImageDocument> {
    const createdImage: IFileImageDocument = await ImageModel.create({
      userId,
      version: imgVersion,
      publicId: imgId,
      type,
      postId
    });

    return createdImage;
  }

  // 4. Remove Image
  public async validateAndRemoveImage(imageId: string, userId: string): Promise<{ image: IFileImageDocument; user: IUserDocument | null }> {
    // 1. Find Image
    const image = await ImageModel.findById(imageId);

    // 2. Validations (Business Logic)
    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // It is forbidden to delete post images from this root.
    if (image.type === 'post') {
      throw new BadRequestError('Cannot delete post images from this endpoint. Please delete the post instead.');
    }

    // Verify ownership
    if (image.userId.toString() !== userId) {
      throw new NotAuthorizedError('You are not authorized to delete this image');
    }

    // 3. Handle "Active Resource" Logic (Profile/Background)
    const user = await UserModel.findById(userId);
    let updatedUser: IUserDocument | null = null;

    if (user) {
      let isModified = false;

      // A. Check Profile Picture
      if (image.type === 'profile' && user.profilePicture.includes(image.publicId)) {
        user.profilePicture = '';
        isModified = true;
      }

      // B. Check Background Image
      if (image.type === 'background' && user.bgImageId === image.publicId) {
        user.bgImageId = '';
        user.bgImageVersion = '';
        isModified = true;
      }

      // C. Save User if modified
      if (isModified) {
        updatedUser = await user.save();
      }
    }

    // 4. Delete Image from Collection
    await ImageModel.deleteOne({ _id: imageId });

    return { image, user: updatedUser };
  }

  // 5. Get Images
  public async getImages(
    userId: string,
    page: number = 1,
    limit: number = 12,
    type?: imageTypes
  ): Promise<{ images: IFileImageDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const query: any = { userId };

    if (type && type !== 'all') {
      query.type = type;
    }

    const imagesPromise = ImageModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const countPromise = ImageModel.countDocuments(query);

    const [images, total] = await Promise.all([imagesPromise, countPromise]);
    return { images, total };
  }
}

export const imageService: ImageService = new ImageService();
