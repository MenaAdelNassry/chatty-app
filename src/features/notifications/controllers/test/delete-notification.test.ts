import { Request, Response } from 'express';
import { Server } from 'socket.io';
import * as notificationServer from '@socket/notification';
import { authUserPayload } from '@root/mocks/auth.mock';
import { mockNotification, notificationMockRequest, notificationMockResponse } from '@root/mocks/notifications.mock';
import { notificationQueue } from '@service/queues/notification.queue';
import { del } from '@notification/controllers/delete-notification';
import HTTP_STATUS from 'http-status-codes';

jest.mock("@service/db/notification.service.ts");

Object.defineProperties(notificationServer, {
  socketIONotificationObject: {
    value: new Server,
    writable: true
  }
});

describe('Delete Notification Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should send correct json response and trigger socket/queue', async () => {
    const req: Request = notificationMockRequest({}, authUserPayload, { notificationId: `${mockNotification._id}` }) as Request;
    const res: Response = notificationMockResponse();

    const socketSpy = jest.spyOn(notificationServer.socketIONotificationObject, 'emit');
    const queueSpy = jest.spyOn(notificationQueue, 'addNotificationJob');

    await del.notification(req, res);

    expect(socketSpy).toHaveBeenCalledWith("delete notification", `${mockNotification._id}`);
    expect(queueSpy).toHaveBeenCalledWith("deleteNotification", {key: `${mockNotification._id}`});
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Notification deleted successfully'
    });
  });
});

