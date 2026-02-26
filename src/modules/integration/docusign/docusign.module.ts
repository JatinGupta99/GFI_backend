import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DocuSignService } from './docusign.service';
import { DocuSignController, DocuSignWebhookController } from './docusign.controller';
import { LeasingModule } from '../../leasing/leasing.module';
import { MediaModule } from '../../media/media.module';
import { LeadsModule } from '../../leads/leads.module';
import { MailModule } from '../../mail/mail.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule,MailModule,JwtModule, HttpModule,LeadsModule, LeasingModule, MediaModule],
  controllers: [DocuSignController, DocuSignWebhookController],
  providers: [DocuSignService],
  exports: [DocuSignService],
})
export class DocuSignModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    const requiredEnvVars = [
      'DOCUSIGN_INTEGRATION_KEY',
      'DOCUSIGN_USER_ID',
      'DOCUSIGN_ACCOUNT_ID',
      'DOCUSIGN_PRIVATE_KEY',
      'DOCUSIGN_BASE_PATH',
      'DOCUSIGN_WEBHOOK_SECRET',
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !this.configService.get(varName),
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required DocuSign environment variables: ${missingVars.join(', ')}. ` +
         'Please ensure all required variables are set in your .env file.',
      );
    }
  }
}
