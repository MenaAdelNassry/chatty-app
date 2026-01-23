import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { blockUserService } from '@service/db/block-user.service'; 

const log: Logger = config.createLogger('blockedUserWorker');

class BlockedUserWorker {
  async addBlockToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { userId, blockedUserId } = job.data;
      await blockUserService.blockUser(userId, blockedUserId);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }

  async removeBlockFromDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { userId, blockedUserId } = job.data;
      await blockUserService.unblockUser(userId, blockedUserId);
      job.progress(100);
      done(null, job.data);
    } catch (error) {
      log.error(error);
      done(error as Error);
    }
  }
}

export const blockedUserWorker: BlockedUserWorker = new BlockedUserWorker();
