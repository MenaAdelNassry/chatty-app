import { DoneCallback, Job } from "bull";
import Logger from "bunyan";
import { config } from "@root/config";
import { commentService } from "@service/db/comment.service";

const log: Logger = config.createLogger("commentWorker");

class CommentWorker {
  async addCommentToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { data } = job;
      await commentService.addCommentToDB(data);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const commentWorker: CommentWorker = new CommentWorker();
