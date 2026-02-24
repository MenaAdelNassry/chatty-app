import { config } from '@root/config';
import ejs from 'ejs';
import fs from 'node:fs';
import path from 'node:path';

class DeactivateTemplate {
  // type: 'self' | 'admin'
  public accountActionTemplate(username: string, type: 'self' | 'admin' | "restore", daysToKeep: number = 30): string {
    const templatePath = path.join(__dirname, 'deactivate-user-template.ejs');

    let image_url = '';

    if(type === 'restore') {
      image_url = 'https://res.cloudinary.com/dpjqyf1hm/image/upload/v1769646509/download_glkapv.jpg';
    } else {
      image_url = 'https://res.cloudinary.com/dpjqyf1hm/image/upload/v1769641091/download_zuyubp.png';
    }

    return ejs.render(fs.readFileSync(templatePath, 'utf-8'), {
      username,
      image_url,
      type,
      daysToKeep,
      app_url: config.CLIENT_URL, // frontend url
      support_url: 'mailto:support@socialapp.com'
    });
  }
}

export const deactivateTemplate: DeactivateTemplate = new DeactivateTemplate();
