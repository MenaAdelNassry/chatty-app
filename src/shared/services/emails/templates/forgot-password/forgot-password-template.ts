import ejs from 'ejs';
import fs from 'node:fs';
import path from 'node:path';

class ForgotPasswordTemplate {
  public passwordResetTemplate(username: string, otp: string, validity: string = "10 minutes"): string {
    const templatePath = path.join(__dirname, 'forgot-password-template.ejs');
    const image_url = 'https://res.cloudinary.com/dpjqyf1hm/image/upload/v1769613622/download_sbkend.png';

    return ejs.render(fs.readFileSync(templatePath, 'utf-8'), {
      username,
      otp,
      validity,
      image_url,
    });
  }
}

export const forgotPasswordTemplate: ForgotPasswordTemplate = new ForgotPasswordTemplate();
