import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/authMiddleware';
import { add } from '@image/controllers/add-image';
import { del } from '@image/controllers/delete-image';
import { get } from '@image/controllers/get-images';

class ImageRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    // 1. Add Profile Image
    this.router.post('/images/profile', authMiddleware.checkAuthentication, add.profileImage);

    // 2. Add Background Image
    this.router.post('/images/background', authMiddleware.checkAuthentication, add.backgroundImage);

    // 3. Get Images (Supports tabs via ?type=...)
    this.router.get('/images/:userId/:page/:type?', authMiddleware.checkAuthentication, get.images);

    // 4. Delete Specific Image (From Gallery)
    this.router.delete('/images/:imageId', authMiddleware.checkAuthentication, del.image);

    return this.router;
  }
}

export const imageRoutes: ImageRoutes = new ImageRoutes();
