import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const smtpHost = process.env.ETHEREAL_HOST;
const smtpPort = parseInt(process.env.ETHEREAL_PORT || "587", 10);
const smtpUser = process.env.ETHEREAL_USER;
const smtpPassword = process.env.ETHEREAL_PASSWORD;
const smtpFrom = process.env.ETHEREAL_FROM || "no-reply@reachinbox.com";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: {
    filename: string;
    content: string;
    contentType?: string;
    encoding: "base64";
  }[];
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.warn(
        "[EmailService] Warning: Ethereal SMTP environment variables (ETHEREAL_USER / ETHEREAL_PASSWORD) are not fully configured in your .env file."
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });
    console.log(`[EmailService] Transporter successfully configured for ${smtpHost}:${smtpPort}`);
  }

  /**
   * Sends an email via configured Ethereal SMTP
   */
  async sendEmail(options: SendEmailOptions): Promise<{ messageId: string; previewUrl?: string }> {
    // If transporter wasn't initialized (e.g. because of missing env vars), try one more time before failing
    if (!this.transporter) {
      this.initializeTransporter();
    }

    if (!this.transporter) {
      throw new Error(
        "[EmailService] SMTP transporter is not configured. Please set ETHEREAL_USER and ETHEREAL_PASSWORD in your .env file."
      );
    }

    const info = await this.transporter.sendMail({
      from: smtpFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || undefined,
    };
  }
}

export const emailService = new EmailService();
