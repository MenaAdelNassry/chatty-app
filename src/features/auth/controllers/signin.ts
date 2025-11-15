import { IEmailJob } from './../../user/interfaces/user.interface';
import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from "express";
import JWT from "jsonwebtoken";
import { config } from "@root/config";
import { authService } from '@service/db/auth.service';
import { BadRequestError, joiRequestValidationError } from '@global/helpers/error-handler';
import { loginSchema } from '@auth/schemes/signin';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';
import { mailTransport } from '@service/emails/mail.transport';
import { emailQueue } from '@service/queues/email.queue';
import { forgotPasswordTemplate } from '@service/emails/templates/forgot-password/forgot-password-template';
import { IResetPasswordParams } from './../../user/interfaces/user.interface';
import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';
import moment from "moment";
import publicIP from "ip";

class Signin {
  public read = async (req: Request, res: Response) => {
    // ----------------- Apply Validation -----------------
    const { value, error } = loginSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // ----------------- Check If Username Existed -----------------
    const { username, password } = value;
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
    const userJwt: string = JWT.sign(
      {
        userId: user._id,
        uId: existingAuthUser.uId,
        email: existingAuthUser.email,
        username: existingAuthUser.username,
        avatarColor: existingAuthUser.avatarColor,
      },
      config.JWT_TOKEN!
    );
    req.session = { token: userJwt };

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
