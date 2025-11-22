import Logger from "bunyan";
import { config } from "@root/config";
import { DoneCallback, Job } from "bull";
import { followerService } from "@service/db/follower.service";

const log: Logger = config.createLogger("followerWorker");

class FollowerWorker {
  async addFollowerToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { keyOne, keyTwo, username, followerDocumentId } = job.data;
      await followerService.addFollowerToDB(keyOne, keyTwo, username, followerDocumentId);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }

  async removeFollowerFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { keyOne, keyTwo } = job.data;
      await followerService.removeFollowerFromDB(keyOne, keyTwo);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const followerWorker: FollowerWorker = new FollowerWorker();
