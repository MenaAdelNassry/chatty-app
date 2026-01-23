import express, { Router } from "express";
import { authMiddleware } from "@global/helpers/authMiddleware";
import { create } from "@post/controllers/create-post";
import { get } from "@post/controllers/get-posts";
import { del } from "@post/controllers/delete-post";
import { update } from "@post/controllers/update-post";

class PostRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/post/:postId', authMiddleware.checkAuthentication, get.postById);
    this.router.get("/post/all/:page", authMiddleware.checkAuthentication, get.posts);
    this.router.get("/post/images/:page", authMiddleware.checkAuthentication, get.postsWithImages);
    this.router.get("/post/videos/:page", authMiddleware.checkAuthentication, get.postsWithVideos);
    this.router.get('/post/user/:userId/:page', authMiddleware.checkAuthentication, get.postsByUserId);

    this.router.post("/post", authMiddleware.checkAuthentication, create.post);
    this.router.post("/post/image/post", authMiddleware.checkAuthentication, create.postWithImage);
    this.router.post("/post/video/post", authMiddleware.checkAuthentication, create.postWithVideo);

    this.router.put("/post/:postId", authMiddleware.checkAuthentication, update.post);

    this.router.delete("/post/:postId", authMiddleware.checkAuthentication, del.post);

    return this.router;
  }
}

export const postRoutes: PostRoutes = new PostRoutes();
