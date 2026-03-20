import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MailService } from './mail.service';
import { EmailController } from './controllers/email.controller';
import { EmailOrchestratorService } from './services/email-orchestrator.service';
import { EmailProcessorService } from './services/email-processor.service';
import { EmailValidatorService } from './services/email-validator.service';
import { EmailAttachmentService } from './services/email-attachment.service';
import { EnhancedMailService } from './services/enhanced-mail.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    ConfigModule,
    MediaModule, // For S3 attachment handling
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

        // Template directory path - use process.cwd() for more reliable path resolution
        const templateDir = join(process.cwd(), 'dist', 'modules', 'mail', 'templates');
        logger.log(`📁 Template directory: ${templateDir}`);

        return {
          transport: transportConfig,
          defaults: {
            from: config.get('MAIL_FROM'),
          },
          template: {
            dir: templateDir,
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
          options: {
            partials: {
              dir: join(templateDir, 'partials'),
              options: {
                strict: true,
              },
            },
          },
        };
      },
    }),
  ],
  controllers: [EmailController],
  providers: [
    // Legacy service for backward compatibility
    MailService,
    
    // New enhanced services following SOLID principles
    EmailOrchestratorService,
    EmailProcessorService,
    EmailValidatorService,
    EmailAttachmentService,
    EnhancedMailService,
  ],
  exports: [
    MailService, // Keep for backward compatibility
    EmailOrchestratorService, // Main service for new implementations
  ],
})
export class MailModule { }
