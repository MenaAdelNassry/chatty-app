import ejs from 'ejs';
import fs from 'node:fs';
import path from 'node:path';
import { IResetPasswordParams } from '@user/interfaces/user.interface';

class ResetPasswordTemplate {
  public passwordResetConfirmationTemplate(templateParams: IResetPasswordParams): string {
    const templatePath = path.join(__dirname, 'reset-password-template.ejs');
    const { username, email, ipaddress, date } = templateParams;

    const image_url = 'https://res.cloudinary.com/dpjqyf1hm/image/upload/v1769614605/images_czlm7x.jpg';

    return ejs.render(fs.readFileSync(templatePath, 'utf-8'), {
      username,
      email,
      ipaddress,
      date,
      image_url,
    });
  }
}

export const resetPasswordTemplate: ResetPasswordTemplate = new ResetPasswordTemplate();
