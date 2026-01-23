import JWT from "jsonwebtoken";
import { NextFunction, Request, Response } from 'express';
import { NotAuthorizedError } from '@global/helpers/error-handler';
import { AuthPayload, IAuthDocument } from '@auth/interfaces/auth.interface';
import { config } from "@root/config";
import { authService } from "@service/db/auth.service";

export class AuthMiddleware {
  public async verifyUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if(!req.session?.token) {
      throw new NotAuthorizedError("Token is not available. Please login again.");
    }

    try {
      const payload: AuthPayload = JWT.verify(req.session.token, config.JWT_TOKEN!) as AuthPayload;
      const authUser: IAuthDocument | null = await authService.getAuthUserByUsername(payload.username);

      if(!authUser) {
        throw new NotAuthorizedError('User is unavailable. Please login again.');
      }

      const currentVersion = authUser.tokenVersion ?? 0;
      const payloadVersion = payload.tokenVersion ?? 0;

      if (currentVersion !== payloadVersion) {
        throw new NotAuthorizedError('Token is invalid. Please login again.');
      }

      req.currentUser = payload;
      next();
    } catch (err) {
      throw new NotAuthorizedError("Token is invalid. Please login again.");
    }
  }

  public checkAuthentication(req: Request, _res: Response, next: NextFunction): void {
    if(!req.currentUser) {
      throw new NotAuthorizedError("Authentication is required to access this route.");
    }
    next();
  }
}

export const authMiddleware: AuthMiddleware = new AuthMiddleware();
