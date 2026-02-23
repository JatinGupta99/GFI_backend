import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';
import { RenewalsProcessor } from './renewals.processor';
// import { RenewalsCronService } from './renewals-cron.service'; // Uncomment if @nestjs/schedule is installed
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { PropertiesModule } from '../properties/properties.module';

@Module({
    imports: [
        RentRollModule,
        PropertiesModule,
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
        // RenewalsCronService, // Uncomment if @nestjs/schedule is installed
    ],
    exports: [
        LeasingService,
    ]
})
export class LeasingModule { }
