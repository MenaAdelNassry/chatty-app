import { DoneCallback, Job } from "bull";
import { config } from "@root/config";
import Logger from "bunyan";
import { chatService } from "@service/db/chat.service";

const log: Logger = config.createLogger("chatWorker");

class ChatWorker {
  async addChatMessageToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { data } = job;
      await chatService.addMessageToDB(data);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async markMessageAsDeletedToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { messageId, type } = job.data;
      await chatService.markMessageAsDeleted(messageId, type);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async markMessageAsReadToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { conversationId, receiverId } = job.data;
      await chatService.markMessageAsRead(conversationId, receiverId);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async updateMessageReaction(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { messageId, senderName, reaction, type } = job.data;
      await chatService.updateMessageReaction(messageId, senderName, reaction, type);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const chatWorker: ChatWorker = new ChatWorker();
