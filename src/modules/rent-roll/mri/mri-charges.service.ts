import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriChargeRaw {
    LeaseID: string;
    ChargeCode: string; // e.g. "RNT", "CAM", "TAX"
    Amount: number;
    Frequency: string;
}

@Injectable()
export class MriChargesService {
    constructor(private readonly mri: MriCoreService) { }

    async fetch(leaseId: string): Promise<MriChargeRaw[]> {
        return this.mri.get<MriChargeRaw[]>('MRI_S-PMRM_RecurringCharges', { LeaseID: leaseId });
    }
}
