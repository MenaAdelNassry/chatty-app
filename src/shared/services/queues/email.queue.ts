import { notificationType } from "@notification/interfaces/notification.interface";
import { BaseQueue } from "@service/queues/base.queue";
import { IEmailJob } from "@user/interfaces/user.interface";
import { emailWorker } from "@worker/email.worker";

class EmailQueue extends BaseQueue {
  constructor() {
    super("emails");
    this.processJob("forgotPasswordEmail", 5, emailWorker.addNotificationEmail);
    this.processJob("confirmPasswordEmail", 5, emailWorker.addNotificationEmail);
    this.processJob("followersEmail", 5, emailWorker.addNotificationEmail);
    this.processJob("commentsEmail", 5, emailWorker.addNotificationEmail);
    this.processJob("reactionsEmail", 5, emailWorker.addNotificationEmail);
    this.processJob("directMessageEmail", 5, emailWorker.addNotificationEmail);
    this.processJob("changePassword", 5, emailWorker.addNotificationEmail);
    this.processJob("deactivateAccount", 5, emailWorker.addNotificationEmail);
    this.processJob("confirmEmail", 5, emailWorker.addNotificationEmail);
  }

  public addEmailJob(name: string, data: IEmailJob): void {
    this.addJob(name, data);
  }

  public addNotificationEmail(type: notificationType, data: IEmailJob): void {
    const jobName = this.mapNotificationTypeToJobName(type);
    this.addJob(jobName, data);
  }

  private mapNotificationTypeToJobName(type: notificationType): string {
    const jobs: Record<notificationType, string> = {
      follows: 'followersEmail',
      comments: 'commentsEmail',
      reactions: 'reactionsEmail',
      messages: 'directMessageEmail'
    };

    return jobs[type];
  }
}

export const emailQueue: EmailQueue = new EmailQueue();
