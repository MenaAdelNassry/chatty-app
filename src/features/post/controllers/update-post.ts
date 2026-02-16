import HTTP_STATUS from 'http-status-codes';
import { postQueue } from '@service/queues/post.queue';
import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';
import { Request, Response } from 'express';
import { updatePostSchema } from '@post/schemes/post.schemes';
import { BadRequestError, joiRequestValidationError, NotAuthorizedError, NotFoundError } from '@global/helpers/error-handler';
import { IPostDocument } from '@post/interfaces/post.interface';
import { UploadApiResponse } from 'cloudinary';
import { uploadToCloudinary } from '@global/helpers/cloudinary-upload';
import { postService } from '@service/db/post.service';
import { imageQueue } from '@service/queues/image.queue';

const postCache: PostCache = new PostCache();

class Update {
  public post = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;

    // 1. 🔒 Security: Check Ownership & Get Original Data
    const originalPost = await this.checkPostOwnership(postId, req.currentUser!.userId);

    // 2. 🛡️ Validation:
    const { value, error } = updatePostSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error?.details[0].message);
    }

    // 3. 🧠 The "Smart" Logic
    // A. Prepare "Final State" Variables (Initialize with Original Data)
    // We modify these based on the request logic below.
    let finalPost = value.post !== undefined ? value.post : originalPost.post;
    let finalBgColor = value.bgColor !== undefined ? value.bgColor : originalPost.bgColor;
    let finalPrivacy = value.privacy !== undefined ? value.privacy : originalPost.privacy;
    let finalFeelings = value.feelings !== undefined ? value.feelings : originalPost.feelings;
    let finalGifUrl = value.gifUrl !== undefined ? value.gifUrl : originalPost.gifUrl;

    let finalImgId = originalPost.imgId;
    let finalImgVersion = originalPost.imgVersion;
    let finalVideoId = originalPost.videoId;
    let finalVideoVersion = originalPost.videoVersion;

    // B. Handle Image Logic 🖼️
    if (value.image !== undefined) {
      // Case: Explicit Delete ("") OR New Image

      if (value.image !== '') {
        // New Image Upload
        const result: UploadApiResponse = await uploadToCloudinary(value.image);
        finalImgId = result.public_id;
        finalImgVersion = result.version.toString();

        // Add Job To Queue (add image to db)
        imageQueue.addImageJob('addImageToDB', {
          key: req.currentUser!.userId,
          publicId: result.public_id,
          version: result?.version?.toString(),
          type: 'post',
          postId
        });

        // Reset conflicting media & bgColor
        finalVideoId = '';
        finalVideoVersion = '';
        finalGifUrl = '';
        finalBgColor = ''; // Image overrides background color
      } else {
        // Explicit Delete
        finalImgId = '';
        finalImgVersion = '';
      }
    }

    // C. Handle Video Logic 🎥
    if (value.video !== undefined) {
      // Case: Explicit Delete ("") OR New Video

      if (value.video !== '') {
        // New Video Upload
        const result: UploadApiResponse = await uploadToCloudinary(value.video, { resource_type: 'video' });
        finalVideoId = result.public_id;
        finalVideoVersion = result.version.toString();

        // Reset conflicting media & bgColor
        finalImgId = '';
        finalImgVersion = '';
        finalGifUrl = '';
        finalBgColor = '';
      } else {
        // Explicit Delete
        finalVideoId = '';
        finalVideoVersion = '';
      }
    }

    // D. Handle GIF Logic 👾
    if (value.gifUrl !== undefined) {
      if(value.gifUrl !== '') {
        finalGifUrl = value.gifUrl;

        // Reset conflicting media
        finalImgId = '';
        finalImgVersion = '';
        finalVideoId = '';
        finalVideoVersion = '';
        finalBgColor = '';
      } else {
        finalGifUrl = '';
      }
    }

    // ---------------------------------------------------------------
    // 4. 👻 Ghost Post Check (Final Validation)
    // ---------------------------------------------------------------
    // Ensure the post isn't becoming completely empty
    const hasText = finalPost && finalPost.trim().length > 0;
    const hasImage = finalImgId && finalImgId.length > 0;
    const hasVideo = finalVideoId && finalVideoId.length > 0;
    const hasGif = finalGifUrl && finalGifUrl.length > 0;

    if (!hasText && !hasImage && !hasVideo && !hasGif) {
      throw new BadRequestError('Post cannot be empty. Add text or media.');
    }

    // 5. Prepare Final Data Object
    const updatedData: IPostDocument = {
      post: finalPost,
      bgColor: finalBgColor,
      privacy: finalPrivacy,
      feelings: finalFeelings,
      gifUrl: finalGifUrl,
      imgId: finalImgId,
      imgVersion: finalImgVersion,
      videoId: finalVideoId,
      videoVersion: finalVideoVersion,
      createdAt: originalPost.createdAt // Important for Redis ZSET scoring
    } as IPostDocument;

    // 6. Save & Emit
    const imgIdToDelete = originalPost.imgId && originalPost.imgId !== finalImgId ? originalPost.imgId : undefined;

    const videoIdToDelete = originalPost.videoId && originalPost.videoId !== finalVideoId ? originalPost.videoId : undefined;

    const updatedPost = await this.updatePostAndNotify(postId, updatedData, imgIdToDelete, videoIdToDelete);

    res.status(HTTP_STATUS.OK).json({ post: updatedPost, message: 'Post updated successfully' });
  };

  // -------------------------------------------------------
  // 🔒 Private Methods (Fixed Logic)
  // -------------------------------------------------------
  private updatePostAndNotify = async (
    postId: string,
    updatedData: IPostDocument,
    imgIdToDelete?: string,
    videoIdToDelete?: string
  ): Promise<IPostDocument> => {
    // 1. Update in Cache
    const updatedPostFromCache = await postCache.updatePostInCache(postId, updatedData);

    // 2. Socket Emit (Only if visible)
    if (updatedPostFromCache.privacy?.toLowerCase() !== 'private') {
      socketIOPostObject.emit('update post', updatedPostFromCache, 'posts');
    }

    // 3. Update in DB (Queue)
    postQueue.addPostJob('updatePostInDB', { key: postId, value: updatedPostFromCache, imgId: imgIdToDelete, videoId: videoIdToDelete });
    return updatedPostFromCache;
  };

  private checkPostOwnership = async (postId: string, currentUserId: string): Promise<IPostDocument> => {
    const cachedPost = await postCache.getPostFromCache(postId, currentUserId);
    const post = cachedPost || (await postService.getOnePost(postId, currentUserId));

    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.userId.toString() !== currentUserId) {
      throw new NotAuthorizedError('Not authorized to update this post');
    }

    return post;
  };
}

export const update: Update = new Update();
