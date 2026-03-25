import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriVacantSuiteRaw {
    BasesuiteOfMeasure: string | null;
    BuildingID: string;
    SuiteID: string;
    SuiteSquareFeet: string;
    SuiteNumber?: string;
}

interface MriSuiteSquareFootage {
    LeasableSquareFeet: string;
}

interface MriSuiteDetail {
    SuiteID: string;
    SuiteNumber: string;
    SuiteSquareFeet: string;
    SuiteSquareFootage: MriSuiteSquareFootage[];
}

interface MriBuildingWithSuites {
    Suites: MriSuiteDetail[];
}

@Injectable()
export class MriVacantSuitesService {
    constructor(private readonly mri: MriCoreService) { }

    /**
     * Fetch all suites for a building with their square footage
     * Uses MRI_S-PMCM_CommercialBuildingWithSuitesByBLDGID API
     * 
     * @param buildingId - The building ID to fetch suites for
     * @returns Array of suites with SuiteID and square footage
     */
    async fetch(buildingId: string, afterDate?: string): Promise<MriVacantSuiteRaw[]> {
        // Fetch building with all suites using the comprehensive API
        const buildingDetails = await this.mri.get<MriBuildingWithSuites[]>('MRI_S-PMCM_CommercialBuildingWithSuitesByBLDGID', {
            BLDGID: buildingId
        });

        if (!buildingDetails || buildingDetails.length === 0 || !buildingDetails[0].Suites) {
            return [];
        }

        // Extract all suites with their square footage
        const allSuites = buildingDetails[0].Suites.map(suite => {
            // Get square footage - prioritize LeasableSquareFeet from SuiteSquareFootage
            const squareFootage = suite.SuiteSquareFootage?.[0]?.LeasableSquareFeet || suite.SuiteSquareFeet || '0';
            
            return {
                BuildingID: buildingId,
                SuiteID: suite.SuiteID,
                SuiteNumber: suite.SuiteNumber || suite.SuiteID,
                SuiteSquareFeet: squareFootage,
                BasesuiteOfMeasure: null,
            };
        });

        return allSuites;
    }
}
