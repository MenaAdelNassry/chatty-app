import { DoneCallback, Job } from "bull";
import { config } from "@root/config";
import Logger from "bunyan";
import { chatService } from "@service/db/chat.service";

const log: Logger = config.createLogger("chatWorker");

class ChatWorker {
  async addChatMessageToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { message } = job.data;
      await chatService.addMessageToDB(message);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async markMessageAsDeletedToDB(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { messageId, type, senderId } = job.data;
      await chatService.deleteMessage(messageId, senderId, type)
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  // async markMessageAsReadToDB(job: Job, done: DoneCallback): Promise<void> {
  //   try {
  //     const { conversationId, receiverId } = job.data;
  //     await chatService.markMessageAsRead(receiverId, conversationId);
  //     job.progress(100);
  //     done(null, job.data)
  //   } catch(err) {
  //     log.error(err);
  //     done(err as Error);
  //   }
  // }

  async markMessageAsDelivered(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { messageId, userId, conversationId } = job.data;
      await chatService.markMessageAsDelivered(userId, conversationId, messageId);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }

  async updateMessageReaction(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { messageId, senderId, reaction } = job.data;
      await chatService.updateMessageReaction(messageId, senderId, reaction);
      job.progress(100);
      done(null, job.data)
    } catch(err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const chatWorker: ChatWorker = new ChatWorker();
