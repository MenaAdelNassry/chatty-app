import express, { Router } from 'express';
import { signup } from '@auth/controllers/signup';
import { signin } from '@auth/controllers/signin';
import { signout } from '@auth/controllers/signout';
import { password } from '@auth/controllers/password';
import { authMiddleware } from '@global/helpers/authMiddleware';
import { verify } from '@auth/controllers/verify-email';
import { resendOtp } from '@auth/controllers/resend-otp';
import passport from 'passport';
import { config } from '@root/config';
import { authLimiter } from '@global/helpers/rate-limiters';

class AuthRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.post('/signup', signup.create);
    this.router.post('/signin', authLimiter, signin.read);

    this.router.post('/forgot-password', password.sendOTP);
    this.router.post('/verify-otp', password.verifyOTP);
    this.router.post('/reset-password', password.resetPassword);
    this.router.post('/verify-email', authMiddleware.verifyUser, verify.update);
    this.router.post('/resend-otp', authMiddleware.verifyUser, resendOtp.handle);

    this.router.get(
      '/auth/google',
      passport.authenticate('google', {
        scope: ['profile', 'email']
      })
    );

    this.router.get(
      '/auth/google/callback',
      passport.authenticate('google', {
        failureRedirect: `${config.CLIENT_URL}`,
        session: false
      }),
      signin.googleAuth
    );

    return this.router;
  }

  public signoutRoute(): Router {
    this.router.get('/signout', signout.update);

    return this.router;
  }
}

export const authRoutes: AuthRoutes = new AuthRoutes();
