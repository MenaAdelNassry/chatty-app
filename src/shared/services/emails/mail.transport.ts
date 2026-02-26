import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import sendGridMail from "@sendgrid/mail";
import { config } from "@root/config";
import Logger from "bunyan";
import { BadRequestError } from "@global/helpers/error-handler";

interface IMailOptions {
  from: string,
  to: string,
  subject: string,
  html: string
}

const log: Logger = config.createLogger("mailOptions");
console.log("fuckeeeeeeeeeeeen Error: ", config.SENDGRID_API_KEY)
sendGridMail.setApiKey(config.SENDGRID_API_KEY!);

class MailTransport {
  constructor() {
    console.log(`📧 Debug: Sending from ${config.SENDER_EMAIL}`);
  }

  public async sendEmail(receiverEmail: string, subject: string, body: string): Promise<void> {
    if(config.NODE_ENV === "development" || config.NODE_ENV === "test") {
      await this.developmentEmailSender(receiverEmail, subject, body);
    } else {
      await this.productionEmailSender(receiverEmail, subject, body);
    }
  }

  private async developmentEmailSender(receiverEmail: string, subject: string, body: string): Promise<void> {
    const transporter: Mail = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: config.SENDER_EMAIL,
        pass: config.SENDER_EMAIL_PASSWORD
      }
    });

    const mailOptions: IMailOptions = {
      from: `Chatty App <${config.SENDER_EMAIL}>`,
      to: receiverEmail,
      subject,
      html: body,
    };

    try {
      await transporter.sendMail(mailOptions);
      log.info("Development email sent successfully.");
    } catch (err) {
      log.error("Error sending email: ", err);
      throw new Error("Error sending email");
    }
  }

  private async productionEmailSender(receiverEmail: string, subject: string, body: string): Promise<void> {
    const mailOptions: IMailOptions = {
      from: `Chatty App <${config.SENDER_EMAIL}>`,
      to: receiverEmail,
      subject,
      html: body,
    };

    try {
      await sendGridMail.send(mailOptions);
      log.info("Production email sent successfully.");
    } catch (err) {
      log.error("Error sending email: ", err);
      throw new BadRequestError("Error sending email");
    }
  }
}

export const mailTransport: MailTransport = new MailTransport();
