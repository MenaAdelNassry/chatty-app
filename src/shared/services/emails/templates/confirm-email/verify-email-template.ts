import ejs from 'ejs';
import fs from 'node:fs';
import path from 'node:path';

class VerifyEmailTemplate {
  public emailVerificationTemplate(username: string, otp: string): string {
    const templatePath = path.join(__dirname, 'verify-email-template.ejs');

    const image_url = 'https://res.cloudinary.com/dpjqyf1hm/image/upload/v1769613622/download_sbkend.png';

    return ejs.render(fs.readFileSync(templatePath, 'utf-8'), {
      username,
      otp,
      image_url,
      action_url: 'http://localhost:3000/verify-email' 
    });
  }
}

export const verifyEmailTemplate: VerifyEmailTemplate = new VerifyEmailTemplate();
