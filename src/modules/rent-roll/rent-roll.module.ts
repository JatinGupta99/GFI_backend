import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { MriCoreService } from './mri/mri-core.service';
import { MriLeasesService } from './mri/mri-leases.service';
import { MriOptionsService } from './mri/mri-options.service';
import { MriChargesService } from './mri/mri-charges.service';
import { MriArService } from './mri/mri-ar.service';
import { MriNotesService } from './mri/mri-notes.service';

import { RentRollService } from './rent-roll.service';
import { RentRollController } from './rent-roll.controller';

@Module({
    imports: [
        HttpModule,
        CacheModule.register({
            ttl: 15 * 60 * 1000, // Global default TTL for this module if needed, or specific
        }),
    ],
    providers: [
        MriCoreService,
        MriLeasesService,
        MriOptionsService,
        MriChargesService,
        MriArService,
        MriNotesService,
        RentRollService,
    ],
    controllers: [
        RentRollController,
    ],
    exports: [
        MriCoreService,
        MriLeasesService,
        MriOptionsService,
        MriChargesService,
        MriArService,
        MriNotesService,
        RentRollService,
    ]
})
export class RentRollModule { }
