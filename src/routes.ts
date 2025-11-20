import { Application } from "express";
import { authRoutes } from "@auth/routes/authRoutes";
import { serverAdapter } from "@service/queues/base.queue";
import { currentRoutes } from "@auth/routes/currentRoutes";
import { authMiddleware } from "@global/helpers/authMiddleware";
import { postRoutes } from "@post/routes/postRoutes";
import { reactionRoutes } from "@reaction/routes/reactionRoutes";

const BASE_URL = "/api/v1";

export default (app: Application) => {
    const routes = () => {
      app.use('/queues', serverAdapter.getRouter());
      app.use(BASE_URL, authRoutes.routes());
      app.use(BASE_URL, authRoutes.signoutRoute());

      app.use(BASE_URL, authMiddleware.verifyUser, currentRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, postRoutes.routes());
      app.use(BASE_URL, authMiddleware.verifyUser, reactionRoutes.routes());
    };
    routes();
}
