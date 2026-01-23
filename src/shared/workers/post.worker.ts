import Logger from 'bunyan';
import { config } from '@root/config';
import { DoneCallback, Job } from 'bull';
import { postService } from '@service/db/post.service';
import { ImageModel } from '@image/models/image.schema';
import { deleteFromCloudinary } from '@global/helpers/cloudinary-upload';

const log: Logger = config.createLogger('postWorker');

class PostWorker {
  async savePostToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value } = job.data;
      await postService.addPostToDB(key, value);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }

  async deletePostFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { keyOne, keyTwo, imgId, videoId } = job.data;

      if (imgId) {
        try {
          const removeFromDBPromise = ImageModel.deleteOne({ postId: keyOne, publicId: imgId });
          const removeFromCloudinaryPromise = deleteFromCloudinary(imgId, 'image');
          await Promise.all([removeFromCloudinaryPromise, removeFromDBPromise]);
        } catch (error) {
          log.error(`Failed to delete image ${imgId} from Cloudinary: ${error} or from Image collection`);
        }
      }

      if (videoId) {
        try {
          await deleteFromCloudinary(videoId, 'video');
        } catch (error) {
          log.error(`Failed to delete video ${videoId} from Cloudinary: ${error} or from Image collection`);
        }
      }

      await postService.deletePost(keyOne, keyTwo);

      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }

  async updatePostInDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key, value, imgId, videoId } = job.data;
      await postService.editPost(key, value);

      if (imgId) {
        try {
          await Promise.all([deleteFromCloudinary(imgId, 'image'), ImageModel.deleteOne({ publicId: imgId })]);
        } catch (error) {
          log.error(`Failed to delete old image ${imgId}: ${error}`);
        }
      }

      // 3. Cleanup Old Video (Best Effort) 🎥
      if (videoId) {
        try {
          await deleteFromCloudinary(videoId, 'video');
        } catch (error) {
          log.error(`Failed to delete old video ${videoId}: ${error}`);
        }
      }

      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const postWorker: PostWorker = new PostWorker();
