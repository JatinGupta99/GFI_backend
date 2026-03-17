import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeaseController } from './lease.controller';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';
import { RenewalsProcessor } from './renewals.processor';
import { LeadsModule } from '../leads/leads.module';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { PropertiesModule } from '../properties/properties.module';
import { Renewal, RenewalSchema } from '../renewals/renewal.entity';
import { RenewalsModule } from '../renewals/renewals.module';
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { Suite, SuiteSchema } from '../suites/schema/suite.schema';
import { SuiteRepository } from '../suites/repository/suite.repository';
import { RenewalRepository } from './repository/renewal.repository';
import { EmailTemplateService } from './services/email-template.service';
import { LeaseEmailService } from './services/lease-email.service';

@Module({
    imports: [
        RentRollModule,
        forwardRef(() => PropertiesModule),
        forwardRef(() => LeadsModule),
        MailModule,
        MediaModule,
        forwardRef(() => RenewalsModule),
        HttpModule,
        MongooseModule.forFeature([
            { name: Renewal.name, schema: RenewalSchema },
            { name: Suite.name, schema: SuiteSchema },
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
        SuiteRepository,
    ],
    exports: [
        LeasingService,
        RenewalRepository,
    ]
})
export class LeasingModule { }
