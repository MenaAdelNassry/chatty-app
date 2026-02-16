import { BadRequestError } from "@global/helpers/error-handler";
import { objectIdSchema } from "@global/helpers/joi.schema";
import { notificationQueue } from "@service/queues/notification.queue";
import { Request, Response } from "express";
import HTTP_STATUS from 'http-status-codes';

class Update {
  public async notification(req: Request, res: Response): Promise<void> {
    const { notificationId } = req.params;

    const { error } = objectIdSchema.validate({ param: notificationId });
    if (error) throw new BadRequestError(error.details[0].message);

    notificationQueue.addNotificationJob("updateNotification", { key: notificationId });

    res.status(HTTP_STATUS.OK).json({ message: 'Notification marked as read' });
  }

  // Method 2: Mark ALL Notifications as Read
  public async allNotifications(req: Request, res: Response): Promise<void> {
    const { userId } = req.currentUser!;

    notificationQueue.addNotificationJob("updateNotification", { userId });

    res.status(HTTP_STATUS.OK).json({ message: 'All notifications marked as read' });
  }
}

export const update: Update = new Update();
