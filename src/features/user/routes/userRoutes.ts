import express, { Router } from "express";
import { authMiddleware } from "@global/helpers/authMiddleware";
import { get } from "@user/controllers/get-profile";
import { search } from "@user/controllers/search-user";
import { update } from "@user/controllers/update-settings";

class UserRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get("/user/all/:page", authMiddleware.checkAuthentication, get.users);

    this.router.put("/user/profile/change-password", authMiddleware.checkAuthentication, update.password);
    this.router.put("/user/profile/basic-info", authMiddleware.checkAuthentication, update.info);
    this.router.put("/user/profile/social-links", authMiddleware.checkAuthentication, update.social);
    this.router.put("/user/profile/notifications", authMiddleware.checkAuthentication, update.notification);
    this.router.get("/user/profile/:userId?", authMiddleware.checkAuthentication, get.userProfileById);

    this.router.get("/user/profile/posts/:page/:userId?", authMiddleware.checkAuthentication, get.userPostsById);

    this.router.get("/user/suggestions", authMiddleware.checkAuthentication, get.randomUserSuggestions);

    this.router.get("/user/search/:query", authMiddleware.checkAuthentication, search.user);

    return this.router;
  }
}

export const userRoutes: UserRoutes = new UserRoutes();
