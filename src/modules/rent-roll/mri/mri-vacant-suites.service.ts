import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriVacantSuiteRaw {
    BaseUnitOfMeasure: string | null;
    BuildingID: string;
    SuiteID: string;
    SuiteSquareFeet: string;
    SuiteNumber?: string;
}

interface MriSuiteDetail {
    SuiteID: string;
    SuiteNumber: string;
}

interface MriBuildingWithSuites {
    Suites: MriSuiteDetail[];
}

@Injectable()
export class MriVacantSuitesService {
    constructor(private readonly mri: MriCoreService) { }

    async fetch(buildingId: string, afterDate?: string): Promise<MriVacantSuiteRaw[]> {
        const currentDate = new Date().toISOString().split('T')[0];

        // 1. Fetch vacant suites (basic info)
        const vacantSuites = await this.mri.get<MriVacantSuiteRaw[]>('MRI_S-PMCM_VacantSuites', {
            BuildingID: buildingId,
            AfterDate: afterDate || currentDate,
        });

        // // 2. Fetch building details to get SuiteNumber mapping
        // // The API returns an array, we expect one building entry since we filter by BLDGID
        // const buildingDetails = await this.mri.get<MriBuildingWithSuites[]>('MRI_S-PMCM_CommercialBuildingWithSuitesByBLDGID', {
        //     BLDGID: buildingId
        // });
        // console.log(JSON.stringify(buildingDetails, null, 2), 'acs;mcs;am');
        // // Create a lookup map for SuiteID -> SuiteNumber
        // const suiteNumberMap = new Map<string, string>();

        // if (buildingDetails && buildingDetails.length > 0 && buildingDetails[0].Suites) {
        //     buildingDetails[0].Suites.forEach(suite => {
        //         suiteNumberMap.set(suite.SuiteID, suite.SuiteNumber);
        //     });
        // }

        // 3. Merge SuiteNumber into vacant suites
        const result = vacantSuites.map(suite => ({
            ...suite,
            SuiteNumber: suite.SuiteID
        }));

        console.log(JSON.stringify(result, null, 2), 'acs;mcs;am');
        return result;
    }
}
