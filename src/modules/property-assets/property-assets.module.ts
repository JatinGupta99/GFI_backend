import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { FollowUpCronService } from './services/follow-up-cron.service';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { Attachment, AttachmentSchema } from './schemas/attachment.schema';
import { Lead, LeadSchema } from '../leads/schema/lead.schema';
import { MediaModule } from '../media/media.module';
import { MailModule } from '../mail/mail.module';
import { CompanyUserModule } from '../company-user/company-user.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Activity.name, schema: ActivitySchema },
            { name: Attachment.name, schema: AttachmentSchema },
            { name: Lead.name, schema: LeadSchema }, // Add Lead model for cron service
        ]),
        MediaModule,
        MailModule,
        CompanyUserModule,
    ],
    controllers: [ActivitiesController, AttachmentsController],
    providers: [ActivitiesService, AttachmentsService, FollowUpCronService],
    exports: [ActivitiesService, AttachmentsService, FollowUpCronService],
})
export class PropertyAssetsModule { }
