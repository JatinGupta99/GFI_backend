import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';
import { RenewalsProcessor } from './renewals.processor';
// import { RenewalsCronService } from './renewals-cron.service'; // Uncomment if @nestjs/schedule is installed
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { PropertiesModule } from '../properties/properties.module';
import { Lease, LeaseSchema } from './schema/lease.schema';
import { LeaseRepository } from './repository/lease.repository';

@Module({
    imports: [
        RentRollModule,
        PropertiesModule,
        BullModule.registerQueue({
            name: 'renewals-sync',
        }),
        MongooseModule.forFeature([
            { name: Lease.name, schema: LeaseSchema },
        ]),
    ],
    controllers: [
        LeasingController,
    ],
    providers: [
        LeasingService,
        RenewalsProcessor,
        LeaseRepository,
        // RenewalsCronService, // Uncomment if @nestjs/schedule is installed
    ],
    exports: [
        LeasingService,
        LeaseRepository,
    ]
})
export class LeasingModule { }
