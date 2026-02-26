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

  async updateUserInfoInDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key: userId, value: updatedInfo } = job.data;
      await userService.updateUserInfo(userId, updatedInfo);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async updateSocialLinksInDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key: userId, value: updatedLinks } = job.data;
      await userService.updateSocialLinks(userId, updatedLinks);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async updateNotificationSettingsInDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key: userId, value: updatedNotification } = job.data;
      await userService.updateNotificationSettings(userId, updatedNotification);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async updateUserStateInDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { key: userId, authId, freezedBy, type, restoredBy } = job.data;

      if(type === 'freeze') {
        await userService.freezeAccount(userId, authId, freezedBy);
      } else if(type === 'unfreeze') {
        await userService.unfreezeUser(userId, restoredBy);
      }

      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const userWorker: UserWorker = new UserWorker();
