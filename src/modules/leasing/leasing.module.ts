import { Module } from '@nestjs/common';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { PropertiesModule } from '../properties/properties.module';

@Module({
    imports: [
        RentRollModule,
        PropertiesModule,
    ],
    controllers: [
        LeasingController,
    ],
    providers: [
        LeasingService,
    ],
    exports: [
        LeasingService,
    ]
})
export class LeasingModule { }
