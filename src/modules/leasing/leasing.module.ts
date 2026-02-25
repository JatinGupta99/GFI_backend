import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';
import { RenewalsProcessor } from './renewals.processor';
// import { RenewalsCronService } from './renewals-cron.service'; // Uncomment if @nestjs/schedule is installed
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { PropertiesModule } from '../properties/properties.module';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { LeaseEmailService } from './services/lease-email.service';
import { EmailTemplateService } from './services/email-template.service';
import { LeadsModule } from '../leads/leads.module';

@Module({
    imports: [
        RentRollModule,
        PropertiesModule,
        LeadsModule,
        MailModule,
        MediaModule,
        HttpModule,
        BullModule.registerQueue({
            name: 'renewals-sync',
        }),
    ],
    controllers: [
        LeasingController,
    ],
    providers: [
        LeasingService,
        RenewalsProcessor,
        LeaseEmailService,
        EmailTemplateService,
        // RenewalsCronService, // Uncomment if @nestjs/schedule is installed
    ],
    exports: [
        LeasingService,
    ]
})
export class LeasingModule { }
