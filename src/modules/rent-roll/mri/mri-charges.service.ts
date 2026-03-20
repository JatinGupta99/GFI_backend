import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriChargeRaw {
    LeaseID: string;
    ChargeCode: string; // income category // e.g. "RNT", "CAM", "TAX"
    Amount: number;
    Frequency: string;
}

// Response from MRI_S-PMCM_CurrentDelinquencies API
interface MriDelinquencyRaw {
    BuildingID: string;
    LeaseID: string;
    SuiteID: string;
    OccupantName: string;
    DelinquentAmount: number;
    ChargeDescription: string;
    ChargeDate: string;
    IncomeCategory: string; // e.g. "BRR", "CAM", "INS", "RET", "LAT"
    IncomeCategoryDescription: string;
}

@Injectable()
export class MriChargesService {
    private readonly logger = new Logger(MriChargesService.name);

    constructor(private readonly mri: MriCoreService) { }

    async fetch(leaseId: string, buildingId?: string): Promise<MriChargeRaw[]> {
        this.logger.debug(`Fetching charges | leaseId=${leaseId} | buildingId=${buildingId || 'not provided'}`);
        
        // Build params object
        const params: Record<string, string> = { LEASEID: leaseId };
        if (buildingId) {
            params.BuildingID = buildingId;
        }
        
        // Use CurrentDelinquencies API instead of RecurringCharges (which returns 400/429)
        const delinquencies = await this.mri.get<MriDelinquencyRaw[]>(
            'MRI_S-PMCM_CurrentDelinquencies',
            params
        );

        // Map delinquencies to charge format
        return delinquencies.map(d => ({
            LeaseID: d.LeaseID,
            ChargeCode: d.IncomeCategory, // Use IncomeCategory as ChargeCode (BRR, CAM, INS, RET, etc.)
            Amount: d.DelinquentAmount,
            Frequency: 'Monthly', // Default to Monthly (API doesn't provide frequency)
        }));
    }
}
