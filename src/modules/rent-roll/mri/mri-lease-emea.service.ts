import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriLeaseEmeaRaw {
    BuildingId: string;
    LeaseId: string;
    OccupantName: string;
    MasterOccupantId: string;
    RentStart: string;
    Expiration: string;
    LastUpdate: string;
    AccountsPhone: string;
    AccountsFax: string;
    Country: string;
    AccountsEmailAddress: string;
    ContactTitle: string;
    ContactInitials: string;
    AttentionTitle: string;
    AttentionInitials: string;
    BillAddress1: string;
    BillAddress2: string;
    BillAddress3: string;
    BillCity: string;
    BillCounty: string;
    BillPostcode: string;
    BillCountry: string;
    EmailAddress: string;
    BillingAddressLine3: string;
    Region: string;
    CountryCode: string;
    VATRegistrationNumber: string;
    IncomeCategory: string;
    CashType: string;
    HeadRentDescription: string;
    AccountNumber: string;
    UnformattedAccountNumber: string;
    NoticeDate: string;
    ReviewPattern: string;
    NextReviewDate: string;
    ReminderPeriod: string;
    TimeOfTheEssence: string;
    UpwardReviewOnly: string;
    SCChargeFromDate: string;
    SCChargeToDate: string;
    TenancyType: string;
    TenancyTypeDescription: string;
    TenancyStatus: string;
    TenancyStatusDescription: string;
}

@Injectable()
export class MriLeaseEmeaService {
    constructor(private readonly mri: MriCoreService) { }

    async fetch(buildingId: string, leaseId?: string): Promise<MriLeaseEmeaRaw[]> {
        const params: any = { BLDGID: buildingId };
        if (leaseId) params.LEASEID = leaseId;
        return this.mri.get<MriLeaseEmeaRaw[]>('MRI_S-PMCM_LeaseEMEAInformation', params);
    }
}
