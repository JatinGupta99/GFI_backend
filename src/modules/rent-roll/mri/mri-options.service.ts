import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriOptionRaw {
    BuildingID: string;
    LeaseID: string;
    OptionDate: string;
    OptionNumber: number;
    TermInMonths: number;
    LastUpdate: string;
    SuiteID: string;
    OptionType: string;
    Notes: string;
    NoticeDate: string;
    Rate: number;
    RateDescription: string;
    SquareFeet: number;
    TermToDate: string;
}

@Injectable()
export class MriOptionsService {
    private readonly logger = new Logger(MriOptionsService.name);

    constructor(private readonly mri: MriCoreService) { }

    async fetch(buildingId: string, leaseId?: string): Promise<MriOptionRaw[]> {
        this.logger.debug(`Fetching options | buildingId=${buildingId} leaseId=${leaseId}`);
        const params: any = { BLDGID: buildingId };
        if (leaseId) params.LEASEID = leaseId;
        return this.mri.get<MriOptionRaw[]>('MRI_S-PMCM_CommercialLeasesLeasOptsByBuildingID', params);
    }
}
