import JWT from "jsonwebtoken";
import { NextFunction, Request, Response } from 'express';
import { NotAuthorizedError } from '@global/helpers/error-handler';
import { AuthPayload } from '@auth/interfaces/auth.interface';
import { config } from "@root/config";

export class AuthMiddleware {
  public verifyUser(req: Request, _res: Response, next: NextFunction): void {
    console.log(req.session)
    if(!req.session?.token) {
      throw new NotAuthorizedError("Token is not available. Please login again.");
    }

    try {
      const payload: AuthPayload = JWT.verify(req.session.token, config.JWT_TOKEN!) as AuthPayload;
      req.currentUser = payload;
    } catch (err) {
      throw new NotAuthorizedError("Token is invalid. Please login again.");
    }
    next();
  }

  public checkAuthentication(req: Request, _res: Response, next: NextFunction): void {
    if(!req.currentUser) {
      throw new NotAuthorizedError("Authentication is required to access this route.");
    }
    next();
  }
}

export const authMiddleware: AuthMiddleware = new AuthMiddleware();
