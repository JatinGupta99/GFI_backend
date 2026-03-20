import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriAnalysisRaw {
    LeaseID: string;
    BudgetRenewType?: string;
    BudgetRentPerSF?: number;
    BudgetTIPerSF?: number;
    BudgetRCD?: string;
    FlexField1?: string;
    FlexField2?: number;
    FlexField3?: number;
    FlexField4?: string;
}

@Injectable()
export class MriAnalysisService {
    private readonly logger = new Logger(MriAnalysisService.name);

    constructor(private readonly mri: MriCoreService) { }

    async fetch(buildingId: string, leaseId?: string): Promise<MriAnalysisRaw[]> {
        this.logger.debug(`Fetching analysis | buildingId=${buildingId} leaseId=${leaseId}`);
        const params: any = { BLDGID: buildingId };
        if (leaseId) params.LEASEID = leaseId;

        // Correcting the API name (Standard MRI CM abbreviated naming convention)
        return this.mri.get<MriAnalysisRaw[]>('MRI_S-PMCM_CommercialLeaseAnlsByBuildingID', params);
    }
}
