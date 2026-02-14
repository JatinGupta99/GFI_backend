import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MriCoreService } from './mri/mri-core.service';
import { MriLeasesService } from './mri/mri-leases.service';
import { MriOptionsService } from './mri/mri-options.service';
import { MriChargesService } from './mri/mri-charges.service';
import { MriArService } from './mri/mri-ar.service';
import { MriNotesService } from './mri/mri-notes.service';
import { MriVacantSuitesService } from './mri/mri-vacant-suites.service';
import { MriRenewalOffersService } from './mri/mri-renewal-offers.service';
import { MriLeaseEmeaService } from './mri/mri-lease-emea.service';
import { MriAnalysisService } from './mri/mri-analysis.service';

import { RentRollService } from './rent-roll.service';
import { RentRollController } from './rent-roll.controller';

@Module({
    imports: [
        HttpModule,
    ],
    providers: [
        MriCoreService,
        MriLeasesService,
        MriOptionsService,
        MriChargesService,
        MriArService,
        MriNotesService,
        RentRollService,
        MriVacantSuitesService,
        MriRenewalOffersService,
        MriLeaseEmeaService,
        MriAnalysisService
    ],
    controllers: [
        RentRollController,
    ],
    exports: [
        MriVacantSuitesService,
        MriCoreService,
        MriLeasesService,
        MriOptionsService,
        MriChargesService,
        MriArService,
        MriNotesService,
        RentRollService,
        MriRenewalOffersService,
        MriLeaseEmeaService,
        MriAnalysisService,
    ]
})
export class RentRollModule { }
