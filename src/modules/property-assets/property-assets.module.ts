import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { Attachment, AttachmentSchema } from './schemas/attachment.schema';
import { MediaModule } from '../media/media.module';

import { CompanyUserModule } from '../company-user/company-user.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Activity.name, schema: ActivitySchema },
            { name: Attachment.name, schema: AttachmentSchema },
        ]),
        MediaModule,
        CompanyUserModule,
    ],
    controllers: [ActivitiesController, AttachmentsController],
    providers: [ActivitiesService, AttachmentsService],
    exports: [ActivitiesService, AttachmentsService],
})
export class PropertyAssetsModule { }
