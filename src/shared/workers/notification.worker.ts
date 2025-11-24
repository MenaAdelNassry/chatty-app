import { DoneCallback, Job } from "bull";
import { config } from "@root/config";
import Logger from "bunyan";
import { notificationService } from "@service/db/notification.service";

const log: Logger = config.createLogger("notificationWorker");

class NotificationWorker {
  async updateNotification(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key } = job.data;
      await notificationService.updateNotification(key);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async deleteNotification(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key } = job.data;
      await notificationService.deleteNotification(key);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const notificationWorker: NotificationWorker = new NotificationWorker();
