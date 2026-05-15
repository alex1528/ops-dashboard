import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Mail transport configured: ${host}:${port}`);
    } else {
      this.logger.warn('SMTP not configured, email sending disabled');
    }
  }

  get isConfigured(): boolean {
    return !!this.transporter;
  }

  async sendMail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured, skipping email');
      return { sent: false, reason: 'SMTP 未配置' };
    }
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    try {
      const info = await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
      return { sent: true, messageId: info.messageId };
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
      return { sent: false, reason: err.message };
    }
  }

  /** Convenience: send notification email to user */
  async sendNotification(to: string, title: string, body: string) {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1890ff;">Ops Dashboard</h2>
        <h3>${title}</h3>
        <div>${body}</div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">此邮件由 Ops Dashboard 系统自动发送</p>
      </div>
    `;
    return this.sendMail(to, `[Ops Dashboard] ${title}`, html);
  }
}
