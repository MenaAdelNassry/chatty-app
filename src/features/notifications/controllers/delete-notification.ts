import { BadRequestError } from "@global/helpers/error-handler";
import { objectIdSchema } from "@global/helpers/joi.schema";
import { notificationQueue } from "@service/queues/notification.queue";
import { Request, Response } from "express";
import HTTP_STATUS from 'http-status-codes';

class Delete {
  public async notification(req: Request, res: Response): Promise<void> {
    const { notificationId } = req.params;

    const { error } = objectIdSchema.validate({ param: notificationId });
    if (error) throw new BadRequestError(error.details[0].message);

    notificationQueue.addNotificationJob("deleteNotification", { key: notificationId });

    res.status(HTTP_STATUS.OK).json({ message: 'Notification deleted successfully' });
  }
}

export const del: Delete = new Delete();
