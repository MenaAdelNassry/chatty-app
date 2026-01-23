/**
  TODO: PERFORMANCE OPTIMIZATION REQUIRED
 * * Current Implementation Issue (Base64 Upload):
 * ---------------------------------------------
 * Currently, we are receiving the video file as a Base64 string in the request body.
 * This causes a "Double Upload" penalty:
 * 1. Client -> Server: The huge Base64 string is loaded into the Server's RAM.
 * 2. Server -> Cloudinary: The server uploads the file to the cloud.
 * * Risks & Scenarios:
 * ------------------
 * 1. Network Timeouts: If the video is > 10MB, the upload process might exceed
 * the standard timeout limit (e.g., Nginx/Heroku 30s timeout), causing
 * a "504 Gateway Timeout" error for the user, even if the server is still working.
 * 2. Server Crash (OOM): Multiple concurrent video uploads can consume all available
 * RAM, leading to an "Out Of Memory" crash, killing the Node.js process.
 * Future Solution (Refactor Plan):
 * --------------------------------
 * 1. Use 'Multer' for Multipart/Form-Data: Stream the file directly to a temporary
 * folder or buffer without loading the entire string into memory.
 * 2. Client-Side Direct Upload (Best Practice): The frontend should request a
 * signed URL from the backend and upload the video directly to Cloudinary.
 * The backend then only receives the 'public_id' and 'version'.
 */

import { IPostDocument } from "@post/interfaces/post.interface";
import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import HTTP_STATUS from 'http-status-codes';
import { postSchema, postWithImageSchema, postWithVideoSchema } from "@post/schemes/post.schemes";
import { joiRequestValidationError } from "@global/helpers/error-handler";
import { PostCache } from "@service/redis/post.cache";
import { socketIOPostObject } from "@socket/post";
import { postQueue } from "@service/queues/post.queue";
import { UploadApiResponse } from "cloudinary";
import { uploadToCloudinary } from "@global/helpers/cloudinary-upload";
import { imageQueue } from "@service/queues/image.queue";

const postCache: PostCache = new PostCache();

class Create {
  public post = async (req: Request, res: Response): Promise<void> => {
    // Apply Validation
    const { value, error } = postSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // Post Preparation
    const postObjectId: ObjectId = new ObjectId();

    const createdPost: IPostDocument = this.createPost({
      ...value, postObjectId,
      currentUser: req.currentUser!
    });

    // Emit And Save Post In Cache and DB
    this.saveAndEmit(req, createdPost);

    // Finally, The Response
    res.status(HTTP_STATUS.CREATED).json({ message: "Post created successfully", post: createdPost });
  }

  public postWithImage = async (req: Request, res: Response): Promise<void> => {
    // Apply Validation
    const { value, error } = postWithImageSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // Upload Image To Cloudinary
    const { image } = value;
    const result: UploadApiResponse = await uploadToCloudinary(image);

    // Post Preparation
    const postObjectId: ObjectId = new ObjectId();
    const createdPost: IPostDocument = this.createPost({
      ...value, postObjectId,
      imgId: result.public_id,
      imgVersion: result.version,
      currentUser: req.currentUser!
    });

    // Emit And Save Post In Cache and DB
    this.saveAndEmit(req, createdPost);

    // Add Job To Queue (add image to db)
    imageQueue.addImageJob("addImageToDB", {
      key: req.currentUser!.userId,
      publicId: result.public_id,
      version: result?.version?.toString(),
      type: "post",
      postId: `${postObjectId}`
    });

    // Finally, The Response
    res.status(HTTP_STATUS.CREATED).json({ message: "Post created with image successfully", post: createdPost });
  }

  public postWithVideo = async (req: Request, res: Response): Promise<void> => {
    // Apply Validation
    const { value, error } = postWithVideoSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // Upload Video To Cloudinary
    const { video } = value;
    const result: UploadApiResponse = await uploadToCloudinary(video, { resource_type: "video" });

    // Post Preparation
    const postObjectId: ObjectId = new ObjectId();
    const createdPost: IPostDocument = this.createPost({
      ...value, postObjectId,
      videoId: result.public_id,
      videoVersion: result.version,
      currentUser: req.currentUser!
    });

    // Emit And Save Post In Cache and DB
    this.saveAndEmit(req, createdPost);

    // Add Job To Queue (add video to db)
    // **************  Not Implemented Yet  *********************

    // Finally, The Response
    res.status(HTTP_STATUS.CREATED).json({ message: "Post created with video successfully", post: createdPost });
  }

  private createPost = (data: any): IPostDocument => {
    return {
      _id: data.postObjectId,
      userId: data.currentUser.userId,
      avatarColor : data.currentUser.avatarColor,
      email: data.currentUser.email,
      username: data.currentUser.username,
      profilePicture: data.currentUser.profilePicture,
      post: data.post,
      bgColor: data.bgColor,
      privacy: data.privacy,
      gifUrl: data.gifUrl,
      feelings: data.feelings,
      commentsCount: 0,
      imgId: data.imgId || '',
      imgVersion: data?.imgVersion?.toString() || '',
      videoId: data.videoId || '',
      videoVersion: data?.videoVersion?.toString() || '',
      createdAt: new Date(),
      reactions: { like: 0, love: 0, happy: 0, sad: 0, wow: 0, angry: 0 },
    } as IPostDocument;
  }

  private saveAndEmit = async (req: Request, createdPost: IPostDocument): Promise<void> => {
    // Emit Post By Socket
    if (createdPost.privacy?.toLowerCase() !== 'private') {
      socketIOPostObject.emit('add post', createdPost);
    }

    // Save Post To Cache
    await postCache.savePostsToCache([createdPost], req.currentUser!.userId, true);

    // Add Job To Queue (add post to db)
    postQueue.addPostJob("addPostToDB", {
      key: req.currentUser!.userId,
      value: createdPost
    });
  }
}

export const create: Create = new Create();
