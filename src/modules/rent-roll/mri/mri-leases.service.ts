import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriLeaseRaw {
    BuildingID: string;
    BuildingName: string;
    OccupantName: string;
    LegalName?: string;
    MasterOccupantID: string;
    SuiteID: string;
    OrigSqFt: number;
    LeaseID: string;
    OccupancyStatus: string;
    LeaseExpirationDate: string;
    ExpirationDate?: string;
    LastUpdate?: string;
    Address1?: string;
    City?: string;
    State?: string;
    Zip?: string;
    GenerationCodeDescription?: string;
    Term?: number;
    LeaseBeginDate?: string;
    VacateDate?: string;
}

@Injectable()
export class MriLeasesService {
    private readonly logger = new Logger(MriLeasesService.name);

    constructor(private readonly mri: MriCoreService) { }

    async fetch(buildingId: string, top?: number, skip?: number, filter?: string): Promise<MriLeaseRaw[]> {
        this.logger.debug(`Fetching leases | buildingId=${buildingId} top=${top} skip=${skip} filter=${filter}`);
        const params: any = { BLDGID: buildingId };
        if (top) params['$top'] = top;
        if (skip) params['$skip'] = skip;
        if (filter) params['$filter'] = filter;
        return this.mri.get<MriLeaseRaw[]>('MRI_S-PMCM_CommercialLeasesLeasByBuildingID', params);
    }
}
