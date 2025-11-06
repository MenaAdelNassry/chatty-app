import express, { Router } from 'express';
import { currentUser } from '@auth/controllers/current-user';
import { authMiddleware } from '@global/helpers/authMiddleware';

class CurrentRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/currentuser', authMiddleware.checkAuthentication, currentUser.read);

    return this.router;
  }
}

export const currentRoutes: CurrentRoutes = new CurrentRoutes();
