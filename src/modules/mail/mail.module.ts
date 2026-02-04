import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const transportConfig = {
          host: config.get('SMTP_HOST'),
          port: Number(config.get('SMTP_PORT')),
          secure: config.get('SMTP_SECURE') === 'true',
          auth: {
            user: config.get('SMTP_USER'),
            pass: config.get('SMTP_PASS'),
          },
          tls: {
            rejectUnauthorized: false,
          },
        };

        const logger = new Logger('MailModule');
        logger.log(
          '📧 Mailer Transport Config: ' +
          JSON.stringify({
            host: transportConfig.host,
            port: transportConfig.port,
            secure: transportConfig.secure,
            authUser: transportConfig.auth.user,
          }),
        );

        return {
          transport: transportConfig,
          defaults: {
            from: config.get('MAIL_FROM'),
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
          options: {
            partials: {
              dir: join(__dirname, 'templates', 'partials'),
              options: {
                strict: true,
              },
            },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule { }
