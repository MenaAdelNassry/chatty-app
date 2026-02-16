import { IChatJobData, IMessageData } from "@chat/interfaces/message.interface";
import { BaseQueue } from "@service/queues/base.queue";
import { chatWorker } from "@worker/chat.worker";

class ChatQueue extends BaseQueue {
  constructor() {
    super("chats");
    this.processJob('addChatMessageToDB', 5, chatWorker.addChatMessageToDB);
    this.processJob('markMessageAsDeletedToDB', 5, chatWorker.markMessageAsDeletedToDB);
    this.processJob('markMessageAsDelivered', 5, chatWorker.markMessageAsDelivered);
    this.processJob('updateMessageReactionToDB', 5, chatWorker.updateMessageReaction);
  }

  public addChatJob(name: string, data: IChatJobData): void {
    this.addJob(name, data);
  }
}

export const chatQueue: ChatQueue = new ChatQueue();
