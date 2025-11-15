import express, { Router } from 'express';
import { signup } from '@auth/controllers/signup';
import { signin } from '@auth/controllers/signin';
import { signout } from '@auth/controllers/signout';
import { password } from '@auth/controllers/password';

class AuthRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.post('/signup', signup.create);
    this.router.post('/signin', signin.read);
    this.router.post('/forgot-password', password.create);
    this.router.put('/reset-password/:token/:userId', password.update);

    return this.router;
  }

  public signoutRoute(): Router {
    this.router.get('/signout', signout.update);

    return this.router;
  }
}

export const authRoutes: AuthRoutes = new AuthRoutes();
