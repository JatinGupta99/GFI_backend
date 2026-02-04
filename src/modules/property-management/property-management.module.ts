import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyManagementController } from './property-management.controller';
import { PropertyManagementService } from './property-management.service';
import { ARNoticeStatus, ARNoticeStatusSchema } from './schema/ar-notice-status.schema';
import { PropertiesModule } from '../properties/properties.module';
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: ARNoticeStatus.name, schema: ARNoticeStatusSchema }]),
        PropertiesModule,
        RentRollModule,
        MailModule
    ],
    controllers: [PropertyManagementController],
    providers: [PropertyManagementService],
    exports: [PropertyManagementService],
})
export class PropertyManagementModule { }
