import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MriCoreService } from './mri/mri-core.service';
import { MriLeasesService } from './mri/mri-leases.service';
import { MriOptionsService } from './mri/mri-options.service';
import { MriChargesService } from './mri/mri-charges.service';
import { MriArService } from './mri/mri-ar.service';
import { MriNotesService } from './mri/mri-notes.service';
import { MriCommercialLeaseNotesService } from './mri/mri-commercial-lease-notes.service';
import { MriVacantSuitesService } from './mri/mri-vacant-suites.service';
import { MriRenewalOffersService } from './mri/mri-renewal-offers.service';
import { MriLeaseEmeaService } from './mri/mri-lease-emea.service';
import { MriAnalysisService } from './mri/mri-analysis.service';
import { MriOpenChargesService } from './mri/mri-open-charges.service';
import { MriTenantLedgerService } from './mri/mri-tenant-ledger.service';
import { MriCurrentDelinquenciesService } from './mri/mri-current-delinquencies.service';
import { MriCommercialLeasesCmreccService } from './mri/mri-commercial-leases-cmrecc.service';

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
        MriCommercialLeaseNotesService,
        RentRollService,
        MriVacantSuitesService,
        MriRenewalOffersService,
        MriLeaseEmeaService,
        MriAnalysisService,
        MriOpenChargesService,
        MriTenantLedgerService,
        MriCurrentDelinquenciesService,
        MriCommercialLeasesCmreccService,
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
        MriCommercialLeaseNotesService,
        RentRollService,
        MriRenewalOffersService,
        MriLeaseEmeaService,
        MriAnalysisService,
        MriOpenChargesService,
        MriTenantLedgerService,
        MriCurrentDelinquenciesService,
        MriCommercialLeasesCmreccService,
    ]
})
export class RentRollModule { }
