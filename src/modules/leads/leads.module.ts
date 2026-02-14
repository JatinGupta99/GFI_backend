import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './repository/lead.repository';
import { Lead, LeadSchema } from './schema/lead.schema';
import { TenantFormProgress, TenantFormProgressSchema } from './schema/tenant-form-progress.schema';
import { LeadsProcessor } from './leads.processor';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { CompanyUserModule } from '../company-user/company-user.module';
import { TasksModule } from '../tasks/tasks.module';
import { BullModule } from '@nestjs/bullmq';
import { DocumentAiModule } from '../document-ai/document-ai.module';
import { JOBNAME } from '../../common/enums/common-enums';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: TenantFormProgress.name, schema: TenantFormProgressSchema },
    ]),
    MailModule,
    MediaModule,
    CompanyUserModule,
    TasksModule,
    DocumentAiModule,
    BullModule.registerQueue({
      name: JOBNAME.LEADS_PROCESSING,
    }),
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository, LeadsProcessor],
  exports: [LeadsService],
})
export class LeadsModule { }
