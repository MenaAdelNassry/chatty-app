import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from "express";
import JWT from "jsonwebtoken";
import { config } from "@root/config";
import { authService } from '@service/db/auth.service';
import { BadRequestError, joiRequestValidationError, NotFoundError } from '@global/helpers/error-handler';
import { loginSchema } from '@auth/schemes/signin';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';

class Signin {
  public read = async (req: Request, res: Response) => {
    // ----------------- Apply Validation -----------------
    const { value, error } = loginSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // ----------------- Check If Username Existed -----------------
    const { username, password, keepLoggedIn } = value;
    const existingAuthUser: IAuthDocument = await authService.getAuthUserByUsername(username);
    if(!existingAuthUser) {
      throw new BadRequestError("Invalid credentials");
    }

    // ----------------- Check If Password Existed -----------------
    const passwordMatch = await existingAuthUser.comparePassword(password);
    if(!passwordMatch) {
      throw new BadRequestError("Invalid credentials");
    }

    // ----------------- Generate JWT -----------------
    const user: IUserDocument = await userService.getUserByAuthId(`${existingAuthUser._id}`);
    if(!user) {
      throw new NotFoundError("User not found");
    }

    const userJwt: string = JWT.sign(
      {
        userId: user._id,
        uId: existingAuthUser.uId,
        email: existingAuthUser.email,
        username: existingAuthUser.username,
        avatarColor: existingAuthUser.avatarColor,
        profilePicture: user.profilePicture,
        tokenVersion: existingAuthUser.tokenVersion ?? 0
      },
      config.JWT_TOKEN!,
      { expiresIn: "7d" }
    );

    req.session = { token: userJwt };
    if(keepLoggedIn) {
      req.sessionOptions.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 Days
    } else {
      req.sessionOptions.maxAge = undefined;
    }

    // ----------------- Finally, The Response  -----------------
    const userDocument: IUserDocument = {
      ...user,
      authId: existingAuthUser._id,
      username: existingAuthUser.username,
      email: existingAuthUser.email,
      avatarColor: existingAuthUser.avatarColor,
      uId: existingAuthUser.uId,
      createdAt: existingAuthUser.createdAt,
    } as IUserDocument;
    res.status(HTTP_STATUS.OK).json({ message: "User login successfully", user: userDocument, token: userJwt });
  }
}

export const signin: Signin = new Signin();
