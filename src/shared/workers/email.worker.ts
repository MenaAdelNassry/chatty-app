import { DoneCallback, Job } from 'bull';
import Logger from 'bunyan';
import { config } from '@root/config';
import { mailTransport } from '@service/emails/mail.transport';
import { resetPasswordTemplate } from '@service/emails/templates/reset-password/reset-password-template';
import { IResetPasswordParams } from '@user/interfaces/user.interface';
import { forgotPasswordTemplate } from '@service/emails/templates/forgot-password/forgot-password-template';
import moment from 'moment';
import { Helpers } from '@global/helpers/helpers';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { deactivateTemplate } from '@service/emails/templates/deactivate-user/deactivate-user-template';
import { verifyEmailTemplate } from '@service/emails/templates/confirm-email/verify-email-template';

const log: Logger = config.createLogger('emailWorker');

class EmailWorker {
  async addNotificationEmail(job: Job, done: DoneCallback): Promise<void> {
    try {
      const { receiverEmail, subject, ip, username, otp, TTL, message, header, type } = job.data;
      const allowedNotifications = ['followersEmail', 'commentsEmail', 'reactionsEmail'];

      let template = '';

      if (job.name === 'forgotPasswordEmail') {
        const validity = Helpers.secondsToMinutesString(TTL);
        template = forgotPasswordTemplate.passwordResetTemplate(username, otp, validity);
      } else if (job.name === 'confirmPasswordEmail') {
        const templateParams: IResetPasswordParams = {
          email: receiverEmail,
          username: username,
          ipaddress: ip!,
          date: moment().format('DD/MM/YYYY HH:mm')
        };

        template = resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);
      } else if (job.name === 'changePassword') {
        const templateParams: IResetPasswordParams = {
          username,
          email: receiverEmail,
          ipaddress: ip!,
          date: moment().format('DD/MM/YYYY HH:mm')
        };

        template = resetPasswordTemplate.passwordResetConfirmationTemplate(templateParams);
      } else if (allowedNotifications.includes(job.name)) {
        const templateParams = {
          username: username!,
          message,
          header
        };

        template = notificationTemplate.notificationTemplate(templateParams);
      } else if(job.name === 'deactivateAccount') {
        template = deactivateTemplate.accountActionTemplate(username, type);
      } else if(job.name === 'confirmEmail') {
        template = verifyEmailTemplate.emailVerificationTemplate(username, otp);
      }

      await mailTransport.sendEmail(receiverEmail, subject, template);
      job.progress(100);
      done(null, job.data);
    } catch (err) {
      log.error(err);
      done(err as Error);
    }
  }
}

export const emailWorker: EmailWorker = new EmailWorker();
