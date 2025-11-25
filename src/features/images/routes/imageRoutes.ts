import { authMiddleware } from "@global/helpers/authMiddleware";
import express, { Router } from "express";
import { add } from "@image/controllers/add-image";
import { del } from "@image/controllers/delete-image";
import { get } from "@image/controllers/get-images";

class ImageRoutes {
  private router: Router

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get("/images/:userId", authMiddleware.checkAuthentication, get.images);

    this.router.post("/images/profile", authMiddleware.checkAuthentication, add.profileImage);
    this.router.post("/images/background", authMiddleware.checkAuthentication, add.backgroundImage);

    this.router.delete("/images/:imageId", authMiddleware.checkAuthentication, del.image);
    this.router.delete("/images/background/:bgImageId", authMiddleware.checkAuthentication, del.backgroundImage);

    return this.router;
  }
}

export const imageRoutes: ImageRoutes = new ImageRoutes();
