import HTTP_STATUS from 'http-status-codes';
import { emailSchema, passwordSchema } from "@auth/schemes/password";
import { Request, Response } from "express";
import { BadRequestError, joiRequestValidationError } from "@global/helpers/error-handler";
import { authService } from "@service/db/auth.service";
import crypto from "node:crypto";
import { config } from "@root/config";
import { emailQueue } from "@service/queues/email.queue";
import { forgotPasswordTemplate } from "@service/emails/templates/forgot-password/forgot-password-template";
import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';
import { IResetPasswordParams } from '@user/interfaces/user.interface';
import publicIP from 'ip';
import moment from 'moment';

class Password {
  public create = async (req: Request, res: Response) : Promise<void> => {
    // ----------------- Apply Validation -----------------
    const { value, error } = emailSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    // ----------------- Check If email Existed -----------------
    const { email } = value;
    const existingUser = await authService.getAuthUserByEmail(email);

    if(!existingUser) {
      throw new BadRequestError("Invalid credentials");
    }

    // ----------------- Give user a new token  -----------------
    const randomBytes: Buffer = crypto.randomBytes(20);
    const randomCharacters: string = randomBytes.toString("hex");
    await authService.updatePasswordToken(`${existingUser._id}`, randomCharacters, Date.now() + 10 * 60 * 1000) // 10 minutes

    // ----------------- Add email job to queue  -----------------
    const resetLink = `${config.CLIENT_URL}/reset-password?token=${randomCharacters}&userId=${existingUser._id}`;
    const template = forgotPasswordTemplate.passwordResetTemplate(existingUser.username, resetLink);

    emailQueue.addEmailJob("forgotPasswordEmail", {
      receiverEmail: email,
      template,
      subject: "Reset your password"
    });

    // ----------------- Finally, The Response  -----------------
    res.status(HTTP_STATUS.OK).json({ message: "Password reset email sent." });
  }

  public update = async (req: Request, res: Response): Promise<void> => {
    // ----------------- Apply Validation -----------------
    const { value, error } = passwordSchema.validate(req.body);
    if(error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    // ----------------- Confirmation from reset token -----------------
    const { token, userId } = req.params;
    const existingUser = await authService.getAuthUserByPasswordToken(token, userId);

    if(!existingUser) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    // ----------------- Change password in DB -----------------
    existingUser.password = value.password;
    existingUser.passwordResetExpires = undefined;
    existingUser.passwordResetToken = undefined;
    await existingUser.save();

    // ----------------- Add email job confirmation -----------------
    const templateParams: IResetPasswordParams = {
      email: existingUser.email,
      username: existingUser.username,
      ipaddress: publicIP.address(),
      date: moment().format("DD/MM/YYYY HH:mm"),
    }
    const template = resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);
    emailQueue.addEmailJob("forgotPasswordEmail", {
      receiverEmail: existingUser.email,
      subject: "Password reset confirmation",
      template,
    });

    // ----------------- Finally, The Response  -----------------
    res.status(HTTP_STATUS.OK).json({ message: "Password successfully updated." });
  }
}

export const password: Password = new Password();
