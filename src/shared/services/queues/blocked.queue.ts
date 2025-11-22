import { IBlockedUserJobData } from "@follower/interfaces/follower.interface";
import { BaseQueue } from "@service/queues/base.queue";
import { blockedUserWorker } from "@worker/blocked.worker";

class BlockedUserQueue extends BaseQueue {
  constructor() {
    super("blockedUsers");
    this.processJob('updateBlockedUserInDB', 5, blockedUserWorker.updateBlockedUserInDB);
    this.processJob('removeBlockedUserFromDB', 5, blockedUserWorker.updateBlockedUserInDB);
  }

  public addBlockedUserJob(name: string, data: IBlockedUserJobData): void {
    this.addJob(name, data);
  }
}

export const blockedUserQueue: BlockedUserQueue = new BlockedUserQueue();
