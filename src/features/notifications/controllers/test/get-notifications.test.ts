import { Request, Response } from 'express';
import { authUserPayload } from '@root/mocks/auth.mock';
import { notificationMockRequest, notificationMockResponse, mockNotification } from '@root/mocks/notifications.mock';
import { notificationService } from '@service/db/notification.service';
import { get } from '@notification/controllers/get-notifications';
import HTTP_STATUS from 'http-status-codes';

jest.mock("@service/db/notification.service.ts");

describe("Get Notifications Controller", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send correct json response with notifications list', async () => {
    const req: Request = notificationMockRequest({}, authUserPayload) as Request;
    const res: Response = notificationMockResponse();

    const serviceSpy = jest.spyOn(notificationService, 'getNotifications').mockResolvedValue([mockNotification]);

    await get.notifications(req, res);

    expect(serviceSpy).toHaveBeenCalledWith(authUserPayload.userId);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User notifications',
      notifications: [mockNotification] 
    });
  });
});

