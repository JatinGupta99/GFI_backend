import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { LeasingController } from './leasing.controller';
import { LeaseController } from './lease.controller';
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
import { RenewalsModule } from '../renewals/renewals.module';
import { Renewal, RenewalSchema } from '../renewals/renewal.entity';
import { RenewalRepository } from './repository/renewal.repository';

@Module({
    imports: [
        RentRollModule,
        PropertiesModule,
        forwardRef(() => LeadsModule),
        MailModule,
        MediaModule,
        forwardRef(() => RenewalsModule), // Import RenewalsModule to access RenewalRepository
        HttpModule,
        MongooseModule.forFeature([
            { name: Renewal.name, schema: RenewalSchema }
        ]),
        BullModule.registerQueue({
            name: 'renewals-sync',
        }),
    ],
    controllers: [
        LeasingController,
        LeaseController,
    ],
    providers: [
        LeasingService,
        RenewalsProcessor,
        LeaseEmailService,
        EmailTemplateService,
        RenewalRepository,
        // RenewalsCronService, // Uncomment if @nestjs/schedule is installed
    ],
    exports: [
        LeasingService,
        RenewalRepository,
    ]
})
export class LeasingModule { }
