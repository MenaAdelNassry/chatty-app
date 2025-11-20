import express, { Router } from "express";
import { authMiddleware } from "@global/helpers/authMiddleware";
import { add } from "@reaction/controllers/add-reactions";
import { get } from "@reaction/controllers/get-reactions";
import { remove } from "@reaction/controllers/remove-reaction";

class ReactionRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get("/post/reactions/:postId", authMiddleware.checkAuthentication, get.reactions);
    this.router.get("/post/single/reaction/username/:username/:postId", authMiddleware.checkAuthentication, get.singleReactionByUsername);
    this.router.get("/post/reactions/username/:username", authMiddleware.checkAuthentication, get.reactionsByUsername);

    this.router.post("/post/reaction", authMiddleware.checkAuthentication, add.reaction);

    this.router.delete("/post/reaction/:postId", authMiddleware.checkAuthentication, remove.reaction);

    return this.router;
  }
}

export const reactionRoutes: ReactionRoutes = new ReactionRoutes();
