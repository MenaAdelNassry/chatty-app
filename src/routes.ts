import { Application } from "express";
import { authRoutes } from "@auth/routes/authRoutes";
import { serverAdapter } from "@service/queues/base.queue";
import { currentRoutes } from "@auth/routes/currentRoutes";
import { authMiddleware } from "@global/helpers/authMiddleware";
import { postRoutes } from "@post/routes/postRoutes";
import { reactionRoutes } from "@reaction/routes/reactionRoutes";
import { commentRoutes } from "@comment/routes/commentsRoutes";
import { followerRoutes } from "@follower/routes/followerRoutes";
import { notificationRoutes } from "@notification/routes/notificationsRoutes";
import { imageRoutes } from "@image/routes/imageRoutes";
import { chatRoutes } from "@chat/routes/chatRoutes";
import { userRoutes } from "@user/routes/userRoutes";

const BASE_URL = "/api/v1";

export default (app: Application) => {
    const routes = () => {
      app.use('/queues', serverAdapter.getRouter());
      app.use(BASE_URL, authRoutes.routes());
      app.use(BASE_URL, authRoutes.signoutRoute());

      app.use(BASE_URL, authMiddleware.verifyUser, currentRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, postRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, reactionRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, commentRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, followerRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, notificationRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, imageRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, chatRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, userRoutes.routes());
    };
    routes();
}
