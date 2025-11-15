import { DoneCallback, Job } from "bull";
import { config } from "@root/config";
import Logger from "bunyan";
import { userService } from "@service/db/user.service";

const log: Logger = config.createLogger("userWorker");

class UserWorker {
  async addUserToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { value } = job.data;
      await userService.addUserToDB(value);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const userWorker: UserWorker = new UserWorker();
