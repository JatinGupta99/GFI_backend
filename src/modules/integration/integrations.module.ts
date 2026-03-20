import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DocumentAiModule } from './document-ai/document-ai.module';
import { DocuSignModule } from './docusign/docusign.module';
import { MriModule } from './mri/mri.module';
import { OpenAiModule } from './open-ai/open-ai.module';

@Module({
  imports: [
    HttpModule,
    DocuSignModule,
    MriModule,
    DocumentAiModule,
    OpenAiModule,
  ],
  exports: [DocuSignModule, MriModule, DocumentAiModule, OpenAiModule],
})
export class IntegrationsModule {}
