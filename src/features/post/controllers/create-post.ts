import { IPostDocument } from "@post/interfaces/post.interface";
import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import HTTP_STATUS from 'http-status-codes';
import { postSchema, postWithImageSchema } from "@post/schemes/post.schemes";
import { BadRequestError, joiRequestValidationError } from "@global/helpers/error-handler";
import { PostCache } from "@service/redis/post.cache";
import { socketIOPostObject } from "@socket/post";
import { postQueue } from "@service/queues/post.queue";
import { UploadApiResponse } from "cloudinary";
import { uploads } from "@global/helpers/cloudinary-upload";
import { imageQueue } from "@service/queues/image.queue";

const postCache: PostCache = new PostCache();

class Create {
  public post = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Apply Validation -----------------
    const { value, error } = postSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // ----------------- Post Preparation -----------------
    const { post, bgColor, privacy, gifUrl, profilePicture, feelings } = value;
    const postObjectId: ObjectId = new ObjectId();

    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      avatarColor : req.currentUser!.avatarColor,
      email: req.currentUser!.email,
      username: req.currentUser!.username,
      profilePicture,
      post,
      bgColor,
      privacy,
      gifUrl,
      feelings,
      commentsCount: 0,
      imgId: '',
      imgVersion: '',
      createdAt: new Date(),
      reactions: { like: 0, love: 0, happy: 0, sad: 0, wow: 0, angry: 0 },
    } as IPostDocument;

    // ----------------- Emit Post By Socket -----------------
    socketIOPostObject.emit('add post', createdPost);

    // ----------------- Save Post To Cache -----------------
    await postCache.savePostToCache({
      key: postObjectId,
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost
    });

    // ----------------- Add Job To Queue (add post to db) -----------------
    postQueue.addPostJob("addPostToDB", {
      key: req.currentUser!.userId,
      value: createdPost
    });

    // ----------------- Finally, The Response  -----------------
    res.status(HTTP_STATUS.CREATED).json({ message: "Post created successfully" });
  }

  public postWithImage = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Apply Validation -----------------
    const { value, error } = postWithImageSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // ----------------- Upload Image To Cloudinary -----------------
    const { post, bgColor, privacy, gifUrl, profilePicture, feelings, image } = value;

    const result: UploadApiResponse = (await uploads(image)) as UploadApiResponse;
    if(!result?.public_id) {
      throw new BadRequestError(result.message);
    }

    // ----------------- Post Preparation -----------------
    const postObjectId: ObjectId = new ObjectId();

    const createdPost: IPostDocument = {
      _id: postObjectId,
      userId: req.currentUser!.userId,
      avatarColor : req.currentUser!.avatarColor,
      email: req.currentUser!.email,
      username: req.currentUser!.username,
      profilePicture,
      post,
      bgColor,
      privacy,
      gifUrl,
      feelings,
      commentsCount: 0,
      imgId: result.public_id,
      imgVersion: result.version.toString(),
      createdAt: new Date(),
      reactions: { like: 0, love: 0, happy: 0, sad: 0, wow: 0, angry: 0 },
    } as IPostDocument;

    // ----------------- Emit Post By Socket -----------------
    socketIOPostObject.emit('add post', createdPost);

    // ----------------- Save Post To Cache -----------------
    await postCache.savePostToCache({
      key: postObjectId,
      currentUserId: `${req.currentUser!.userId}`,
      uId: `${req.currentUser!.uId}`,
      createdPost
    });

    // ----------------- Add Job To Queue (add post to db) -----------------
    postQueue.addPostJob("addPostToDB", {
      key: req.currentUser!.userId,
      value: createdPost
    });

    // ----------------- Add Job To Queue (add image to db) -----------------
    imageQueue.addImageJob("addImageToDB", {
      key: req.currentUser!.userId,
      publicId: result.public_id,
      version: result.version.toString(),
      type: "post"
    });

    // ----------------- Finally, The Response  -----------------
    res.status(HTTP_STATUS.CREATED).json({ message: "Post created with image successfully" });
  }

}

export const create: Create = new Create();
