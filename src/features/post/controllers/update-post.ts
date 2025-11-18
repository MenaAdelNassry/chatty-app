import HTTP_STATUS from 'http-status-codes';
import { postQueue } from "@service/queues/post.queue";
import { PostCache } from "@service/redis/post.cache";
import { socketIOPostObject } from "@socket/post";
import { Request, Response } from "express";
import { postSchema, postWithImageSchema } from '@post/schemes/post.schemes';
import { BadRequestError, joiRequestValidationError } from '@global/helpers/error-handler';
import { IPostDocument } from '@post/interfaces/post.interface';
import { UploadApiResponse } from 'cloudinary';
import { uploads } from '@global/helpers/cloudinary-upload';

const postCache: PostCache = new PostCache();

class Update {
  public post = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Validation  -----------------
    const { value, error } = postSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // ----------------- Helper Function -----------------
    await this.updatePostAndNotify(req.params.postId, value);

    // ----------------- Finally, Response -----------------
    res.status(HTTP_STATUS.OK).json({ message: 'Post updated successfully' });
  }

  public postWithImage = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Validation -----------------
    const { value, error } = postWithImageSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // ----------------- Image data preparation -----------------
    const { imgId, imgVersion, image } = req.body;
    let newImgId = imgId;
    let newImgVersion = imgVersion;

    // ----------------- Determine whether the change requires a new image or just text -----------------
    if(image && (!imgId || !imgVersion)) {
      // this means the user add new image for this post (not exist in our cloudinary)
      const result: UploadApiResponse = await uploads(image) as UploadApiResponse;
      if (!result.public_id) {
        throw new BadRequestError(result.message);
      }
      newImgId = result.public_id;
      newImgVersion = result.version.toString();
    }

    // ----------------- Helper Function -----------------
    const updatedData = {
      ...value,
      imgId: newImgId,
      imgVersion: newImgVersion
    };
    await this.updatePostAndNotify(req.params.postId, updatedData);

    res.status(HTTP_STATUS.OK).json({ message: 'Post with image updated successfully' });
  }

  private updatePostAndNotify = async (postId: string, data: IPostDocument): Promise<void> => {
    // ----------------- Final Object Prepration  -----------------
    const updatedPost: IPostDocument = {
      post: data.post,
      bgColor: data.bgColor,
      privacy: data.privacy,
      feelings: data.feelings,
      gifUrl: data.gifUrl,
      profilePicture: data.profilePicture,
      imgId: data.imgId ? data.imgId : '',
      imgVersion: data.imgVersion ? data.imgVersion : '',
    } as IPostDocument;

    // ----------------- Cache Update  -----------------
    const updatedPostFromCache: IPostDocument = await postCache.updatePostInCache(postId, updatedPost);

    // ----------------- Socket Update  -----------------
    socketIOPostObject.emit("update post", updatedPostFromCache, "posts");

    // ----------------- Add Job To Queue(for DB)  -----------------
    postQueue.addPostJob("updatePostInDB", { key: postId, value: updatedPostFromCache });

    // TODO: if we have new image we will add job to image queue to add it to DB
    // later on, we will add image collection and its queue

    // TODO: Add background job to delete oldImgId from Cloudinary to save space.
  }
}

export const update: Update = new Update();
