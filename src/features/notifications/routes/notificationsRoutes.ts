import { authMiddleware } from "@global/helpers/authMiddleware";
import express, { Router } from "express";
import { update } from "@notification/controllers/update-notification"
import { del } from "@notification/controllers/delete-notification"
import { get } from "@notification/controllers/get-notifications"

class NotificationRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes() {
    this.router.get('/notifications', authMiddleware.checkAuthentication, get.notifications);
    this.router.put('/notification/:notificationId', authMiddleware.checkAuthentication, update.notification);
    this.router.put('/notifications/mark-as-read', authMiddleware.checkAuthentication, update.allNotifications);
    this.router.delete('/notification/:notificationId', authMiddleware.checkAuthentication, del.notification);

    return this.router;
  }
}

export const notificationRoutes: NotificationRoutes = new NotificationRoutes();
