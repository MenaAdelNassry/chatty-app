import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from "express";

export class Signout {
  public update = async (req: Request, res: Response): Promise<void> => {
    req.session = null;
    res.status(HTTP_STATUS.OK).json({ message: "Logout successfully", user: {}, token: '' });
  }
}

export const signout: Signout = new Signout();
