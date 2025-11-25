import { IFileImageDocument, imageTypes } from "@image/interfaces/image.interface";
import { ImageModel } from "@image/models/image.schema";
import { UserModel } from "@user/models/user.schema";
import mongoose from "mongoose";
import { userService } from "./user.service";

class ImageService {
  public async addUserProfileImageToDB(userId: string, imgVersion: string, imgId: string, url: string): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $set: { profilePicture: url } });
    await this.addImage(userId, imgVersion, imgId, 'profile');
  }

  public async addBackgroundImageToDB(userId: string, imgVersion: string, imgId: string): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $set: { bgImageId: imgId, bgImageVersion: imgVersion } });
    await this.addImage(userId, imgVersion, imgId, 'background');
  }

  public async addImage(userId: string, imgVersion: string, imgId: string, type: imageTypes): Promise<void> {
    await ImageModel.create({
      userId,
      version: imgVersion,
      publicId: imgId,
      type,
    });
  }

  public async removeImageFromDB(imageId: string): Promise<void> {
    const image: (IFileImageDocument | null) = await ImageModel.findById(imageId);
    if(!image) return;

    await ImageModel.deleteOne({ _id: imageId });

    if(image.type === 'background') {
      await userService.removeBackgroundImage(image.userId.toString(), image.publicId);
    }
  }

  public async getImageByBackgroundId(bgImageId: string): Promise<IFileImageDocument | null> {
    const image: IFileImageDocument | null = await ImageModel.findOne({
      publicId: bgImageId,
      type: "background"
    });

    return image;
  }

  public async getImages(userId: string): Promise<IFileImageDocument[]> {
    const images: IFileImageDocument[] = await ImageModel.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
    .sort({ createdAt: -1 });

    return images;
  }

}

export const imageService: ImageService = new ImageService();
