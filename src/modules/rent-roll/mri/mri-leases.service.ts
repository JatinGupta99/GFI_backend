import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriLeaseRaw {
    BuildingName: string;
    OccupantName: string;
    SuiteID: string;
    OrigSqFt: number;
    LeaseID: string;
    MasterOccupantID: string;
    OccupancyStatus: string;
}

@Injectable()
export class MriLeasesService {
    constructor(private readonly mri: MriCoreService) { }

    async fetch(buildingId: string): Promise<MriLeaseRaw[]> {
        return this.mri.get<MriLeaseRaw[]>('MRI_S-PMCM_CommercialLeasesLeasByBuildingID', { BldgID: buildingId });
    }
}
