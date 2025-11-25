import { DoneCallback, Job } from "bull";
import { config } from "@root/config";
import Logger from "bunyan";
import { imageService } from "@service/db/image.service";

const log: Logger = config.createLogger("imageWorker");

class ImageWorker {
  async addUserProfileImageToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key: userId, value: url, publicId, version } = job.data;
      await imageService.addUserProfileImageToDB(userId, version, publicId, url);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async addBackgroundImageToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key: userId, publicId, version } = job.data;
      await imageService.addBackgroundImageToDB(userId, version, publicId);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async addImageToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key: userId, publicId, version, type } = job.data;
      await imageService.addImage(userId, version, publicId, type);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async removeImageFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { imageId } = job.data;
      await imageService.removeImageFromDB(imageId);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const imageWorker: ImageWorker = new ImageWorker();
