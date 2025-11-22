import { authMiddleware } from "@global/helpers/authMiddleware";
import express, { Router } from "express";
import { add } from "@follower/controllers/follower-user";
import { remove } from "@follower/controllers/unfollow-user";
import { get } from "@follower/controllers/get-followers";
import { blockUser } from "@follower/controllers/block-user";

class FollowerRoutes {
  private router: Router

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get("/user/following", authMiddleware.checkAuthentication, get.userFollowing);
    this.router.get("/user/followers", authMiddleware.checkAuthentication, get.userFollowers);

    this.router.put("/user/follow/:followeeId", authMiddleware.checkAuthentication, add.follower);
    this.router.put("/user/unfollow/:followeeId", authMiddleware.checkAuthentication, remove.follower);
    this.router.put("/user/block/:blockedUserId", authMiddleware.checkAuthentication, blockUser.block);
    this.router.put("/user/unblock/:blockedUserId", authMiddleware.checkAuthentication, blockUser.unblock);

    return this.router;
  }
}

export const followerRoutes: FollowerRoutes = new FollowerRoutes();
