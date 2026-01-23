import { INotificationTemplate } from '@notification/interfaces/notification.interface';
import ejs from 'ejs';
import fs from 'node:fs';
import path from 'node:path';

class NotificationTemplate {
  public notificationTemplate(templateParams: INotificationTemplate): string {
    const { username, header, message } = templateParams;
    const templatePath = path.join(__dirname, 'notification-template.ejs');
    const image_url = "https://res.cloudinary.com/dpjqyf1hm/image/upload/v1767126335/image_2025-12-30_222515605_mr8cfd.png";

      return ejs.render(fs.readFileSync(templatePath, 'utf-8'), {
      username,
      header,
      message,
      image_url,
    });
  }
}

export const notificationTemplate: NotificationTemplate = new NotificationTemplate();
