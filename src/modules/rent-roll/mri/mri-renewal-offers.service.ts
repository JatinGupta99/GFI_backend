import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriRenewalOfferRaw {
    NameId: string;
    LeaseTerm: string;
    RenewalEffectiveDate: string;
    ChargeCode: string;
    RenewalAmount: number;
    TotalConcessionAmount: number;
    Selected: string;
    ExpirationDate: string;
    LastDate: string;
    LeaseID: string;
}

@Injectable()
export class MriRenewalOffersService {
    constructor(private readonly mri: MriCoreService) { }

    /**
     * info: Retrieves the latest renewal offers for a resident
     * API: MRI_S-PMRM_ResidentialRenewalOffers
     */
    async fetch(propertyId: string): Promise<MriRenewalOfferRaw[]> {
        return this.mri.get<MriRenewalOfferRaw[]>('MRI_S-PMRM_ResidentialRenewalOffers', { PROPERTYID: propertyId });
    }
}
