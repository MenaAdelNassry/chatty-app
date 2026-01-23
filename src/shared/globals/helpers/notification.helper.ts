import { notificationType } from "@notification/interfaces/notification.interface";

interface IEmailMetadata {
  subject: string;
  header: string;
}

export class NotificationSystemHelper {

  static getEmailMetadata(type: notificationType, username: string): IEmailMetadata {
    switch (type) {
      case 'follows':
        return {
          subject: `${username} is now following you.`,
          header: 'New Follower 🚀'
        };

      case 'comments':
        return {
          subject: `${username} commented on your post.`,
          header: 'New Comment 💬'
        };

      case 'reactions':
        return {
          subject: `${username} reacted to your post.`,
          header: 'New Reaction ❤️'
        };

      case 'messages':
        return {
          subject: `${username} sent you a message.`,
          header: 'New Message 📩'
        };

      default:
        return {
          subject: 'New Notification from App',
          header: 'New Notification 🔔'
        };
    }
  }
}
