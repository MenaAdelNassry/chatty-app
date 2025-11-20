import Logger from "bunyan";
import { config } from "@root/config";
import { DoneCallback, Job } from "bull";
import { reactionService } from "@service/db/reaction.service";

const log: Logger = config.createLogger("reactionWorker");

class ReactionWorker {
  async addReactionToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { data } = job;
      reactionService.addReactionDataToDB(data);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }

  async removeReactionFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { data } = job;
      reactionService.removeReactionDataFromDB(data);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const reactionWorker: ReactionWorker = new ReactionWorker();
