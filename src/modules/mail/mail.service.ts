import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailConfigs } from '../../common/config';
import { EmailType } from '../../common/enums/common-enums';


@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;
  public readonly EmailConfigs = EmailConfigs;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  async send(type: EmailType, payload: any) {
    this.logger.debug(`send() called with type: ${type}, email: ${payload.email}`);

    const config = this.EmailConfigs[type];
    if (!config) {
      this.logger.error(`Invalid email type: ${type}`);
      throw new InternalServerErrorException('Invalid email type');
    }

    const data = {
      ...payload,
      year: new Date().getFullYear(),
      resetLink: payload?.token
        ? `${this.frontendUrl}/auth/reset-password?token=${encodeURIComponent(payload.token)}`
        : undefined,
      setupLink: payload?.token
        ? `${this.frontendUrl}/auth/setup-password?token=${encodeURIComponent(payload.token)}`
        : undefined,
    };

    const subject = typeof config.subject === 'function' ? config.subject(payload) : config.subject;

    this.logger.debug(`Email details - To: ${payload.email}, Subject: ${subject}, Template: ${config.template}`);
    if (data.resetLink) {
      this.logger.debug(`Reset link: ${data.resetLink}`);
    }

    try {
      this.logger.debug(`Attempting to send email via SMTP...`);

      await this.mailerService.sendMail({
        to: payload.email,
        subject,
        template: config.template,
        context: data,
      });

      this.logger.log(`  Email sent successfully to ${payload.email}`);
    } catch (err) {
      this.logger.error(`❌ Failed to send email to ${payload.email}`);

      if (err instanceof Error) {
        this.logger.error(`Error details: ${err.message}`);
        if (err.stack) {
          this.logger.error(`Stack trace: ${err.stack}`);
        }
      } else {
        this.logger.error(`Error details: ${String(err)}`);
      }

      const smtpError = err as any;
      if (smtpError?.code) {
        this.logger.error(`SMTP Error Code: ${smtpError.code}`);
      }
      if (smtpError?.response) {
        this.logger.error(`SMTP Response: ${smtpError.response}`);
      }

      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
