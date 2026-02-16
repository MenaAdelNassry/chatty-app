import { BaseQueue } from "@service/queues/base.queue";
import { IUserJob } from "@user/interfaces/user.interface";
import { userWorker } from "@worker/user.worker";

class UserQueue extends BaseQueue {
  constructor() {
    super("user");
    this.processJob('addUserToDB', 5, userWorker.addUserToDB);
    this.processJob('updateUserInfoInDB', 5, userWorker.updateUserInfoInDB);
    this.processJob('updateSocialLinksInDB', 5, userWorker.updateSocialLinksInDB);
    this.processJob('updateNotificationSettingsInDB', 5, userWorker.updateNotificationSettingsInDB);
    this.processJob('updateUserState', 5, userWorker.updateUserStateInDB);
  }

  public addUserJob(name: string, data: IUserJob): void {
    this.addJob(name, data);
  }
}

export const userQueue: UserQueue = new UserQueue();
