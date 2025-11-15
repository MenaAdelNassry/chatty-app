import { DoneCallback, Job } from "bull";
import { config } from "@root/config";
import Logger from "bunyan";
import { authService } from "@service/db/auth.service";

const log: Logger = config.createLogger("authWorker");

class AuthWorker {
  async addAuthUserToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { value } = job.data;
      await authService.addAuthUserToDB(value);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const authWorker: AuthWorker = new AuthWorker();
