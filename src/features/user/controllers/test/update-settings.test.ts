import { Request, Response } from 'express';
import { authMockRequest, authMockResponse, authUserPayload } from '@root/mocks/auth.mock';
import { update } from '@user/controllers/update-settings';
import { userService } from '@service/db/user.service';
import { UserCache } from '@service/redis/user.cache';
import { userQueue } from '@service/queues/user.queue';
import { emailQueue } from '@service/queues/email.queue';
import * as publicIP from 'ip';
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/db/user.service');
jest.mock('@service/redis/user.cache');
jest.mock('@service/queues/user.queue');
jest.mock('@service/queues/email.queue');
jest.mock('ip'); // Mocking IP library

describe('Update Settings Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // 1. Test: Password Update
  // ========================================================================
  describe('password', () => {
    it('should update password, send email and return correct json response', async () => {
      // Arrange
      const body = { currentPassword: '123456', newPassword: '12345678', confirmPassword: '12345678' };
      const req: Request = authMockRequest({}, body, authUserPayload) as Request;
      const res: Response = authMockResponse();

      // Mocks
      jest.spyOn(userService, 'updatePassword');
      jest.spyOn(publicIP, 'address').mockReturnValue('127.0.0.1');
      const emailSpy = jest.spyOn(emailQueue, 'addEmailJob');

      // Act
      await update.password(req, res);

      // Assert
      expect(userService.updatePassword).toHaveBeenCalledWith(
        authUserPayload.username,
        body.newPassword,
        body.currentPassword
      );

      // 2. التأكد من إرسال الإيميل
      expect(emailSpy).toHaveBeenCalledWith('changePassword', expect.objectContaining({
        receiverEmail: authUserPayload.email,
        subject: 'Password update confirmation'
      }));

      // 3. الرد
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password updated successfully. You will be redirected shortly to the login page.'
      });
    });
  });

  // ========================================================================
  // 2. Test: Basic Info Update
  // ========================================================================
  describe('info', () => {
    it('should update "info" in cache and queue', async () => {
      // Arrange
      const body = {
        quote: 'My Quote',
        work: 'Developer',
        school: 'MIT',
        location: 'New York'
      };
      const req: Request = authMockRequest({}, body, authUserPayload) as Request;
      const res: Response = authMockResponse();

      // Spies
      const cacheSpy = jest.spyOn(UserCache.prototype, 'updateUserItemsInCache');
      const queueSpy = jest.spyOn(userQueue, 'addUserJob');

      // Act
      await update.info(req, res);

      // Assert
      expect(cacheSpy).toHaveBeenCalledWith(authUserPayload.userId, body);

      expect(queueSpy).toHaveBeenCalledWith('updateUserInfoInDB', {
        key: authUserPayload.userId,
        value: body
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Basic information updated successfully' });
    });
  });

  // ========================================================================
  // 3. Test: Social Links Update
  // ========================================================================
  describe('social', () => {
    it('should update "social" links in cache and queue', async () => {
      // Arrange
      const body = {
        facebook: 'https://facebook.com/test',
        instagram: 'https://instagram.com/test',
        twitter: 'https://twitter.com/test',
        youtube: 'https://youtube.com/test'
      };
      const req: Request = authMockRequest({}, body, authUserPayload) as Request;
      const res: Response = authMockResponse();

      const cacheSpy = jest.spyOn(UserCache.prototype, 'updateUserItemsInCache');
      const queueSpy = jest.spyOn(userQueue, 'addUserJob');

      // Act
      await update.social(req, res);

      // Assert
      expect(cacheSpy).toHaveBeenCalledWith(authUserPayload.userId, { social: body });

      expect(queueSpy).toHaveBeenCalledWith('updateSocialLinksInDB', {
        key: authUserPayload.userId,
        value: body
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Social links updated successfully' });
    });
  });

  // ========================================================================
  // 4. Test: Notifications Settings Update
  // ========================================================================
  describe('notification', () => {
    it('should update "notifications" settings in cache and queue', async () => {
      // Arrange
      const body = {
        messages: true,
        reactions: false,
        comments: true,
        follows: false
      };
      const req: Request = authMockRequest({}, body, authUserPayload) as Request;
      const res: Response = authMockResponse();

      const cacheSpy = jest.spyOn(UserCache.prototype, 'updateUserItemsInCache');
      const queueSpy = jest.spyOn(userQueue, 'addUserJob');

      // Act
      await update.notification(req, res);

      // Assert
      expect(cacheSpy).toHaveBeenCalledWith(authUserPayload.userId, { notifications: body });

      expect(queueSpy).toHaveBeenCalledWith('updateNotificationSettingsInDB', {
        key: authUserPayload.userId,
        value: body
      });

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({ message: 'Notification settings updated successfully' });
    });
  });
});
