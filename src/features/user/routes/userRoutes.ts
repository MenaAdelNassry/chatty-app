import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/authMiddleware';
import { get } from '@user/controllers/get-profile';
import { search } from '@user/controllers/search-user';
import { update } from '@user/controllers/update-settings';

class UserRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.put('/user/profile/change-password', authMiddleware.checkAuthentication, update.password);
    this.router.put('/user/profile/basic-info', authMiddleware.checkAuthentication, update.info);
    this.router.put('/user/profile/social-links', authMiddleware.checkAuthentication, update.social);
    this.router.put('/user/profile/notifications', authMiddleware.checkAuthentication, update.notification);

    // 1. Get My Profile
    this.router.get('/user/profile', authMiddleware.checkAuthentication, get.profile);

    // 2. Get User Suggestions (Random)
    this.router.get('/user/profile/suggestions', authMiddleware.checkAuthentication, get.randomUserNodes);

    // 3. Get Other User Profile (By ID)
    this.router.get('/user/profile/:userId', authMiddleware.checkAuthentication, get.profileByUserId);

    // 4. Get Search
    this.router.get('/user/search/:query/:page', authMiddleware.checkAuthentication, search.user);

    return this.router;
  }
}

export const userRoutes: UserRoutes = new UserRoutes();
