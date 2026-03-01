import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriCommercialLeaseNote {
    BuildingID: string;
    LeaseID: string;
    NoteDate: string;
    NoteText: string;
    NoteReference1: string;
    NoteReference2: string;
    LastUpdate: string;
    UserID: string;
}

export interface CreateCommercialLeaseNoteDto {
    BuildingID: string;
    LeaseID: string;
    NoteDate: string;
    NoteText?: string;
    NoteReference1: string;
    NoteReference2: string;
}

export interface FetchCommercialLeaseNotesParams {
    BLDGID: string;
    LEASEID?: string;
    LASTUPDATEDATE?: string;
    OLDESTNOTEDATE?: string;
}

@Injectable()
export class MriCommercialLeaseNotesService {
    private readonly logger = new Logger(MriCommercialLeaseNotesService.name);

    constructor(private readonly mri: MriCoreService) { }

    /**
     * Fetch commercial lease notes using MRI stored procedure
     * Stored Procedure: MRI_S-PMCM_CommercialLeasesNoteByBuildingID (GET)
     * 
     * @param params - Query parameters for filtering notes
     * @param params.BLDGID - Building ID (required)
     * @param params.LEASEID - Lease ID (optional)
     * @param params.LASTUPDATEDATE - Include only records modified since this date (optional)
     * @param params.OLDESTNOTEDATE - Include only records created since this date (optional)
     */
    async fetch(params: FetchCommercialLeaseNotesParams): Promise<MriCommercialLeaseNote[]> {
        this.logger.debug(`Fetching commercial lease notes | params=${JSON.stringify(params)}`);
        
        const result = await this.mri.get<{ entry: MriCommercialLeaseNote[] }>(
            'MRI_S-PMCM_CommercialLeasesNoteByBuildingID',
            params
        );

        // Handle both array and object responses
        if (Array.isArray(result)) {
            return result;
        }
        
        return result?.entry ? (Array.isArray(result.entry) ? result.entry : [result.entry]) : [];
    }

    /**
     * Create a new commercial lease note using MRI stored procedure
     * Stored Procedure: MRI_S-PMCM_CommercialLeasesNoteByBuildingID (POST)
     * 
     * @param noteData - The note data to create
     */
    async create(noteData: CreateCommercialLeaseNoteDto): Promise<MriCommercialLeaseNote> {
        this.logger.debug(`Creating commercial lease note | buildingId=${noteData.BuildingID} leaseId=${noteData.LeaseID}`);
        
        const body = {
            'mri_s-pmcm_commercialleasesnotebybuildingid': {
                entry: {
                    BuildingID: noteData.BuildingID,
                    LeaseID: noteData.LeaseID,
                    NoteDate: noteData.NoteDate,
                    NoteText: noteData.NoteText || '',
                    NoteReference1: noteData.NoteReference1,
                    NoteReference2: noteData.NoteReference2
                }
            }
        };

        const result = await this.mri.put<{ entry: MriCommercialLeaseNote }>(
            'MRI_S-PMCM_CommercialLeasesNoteByBuildingID',
            { '$format': 'json' },
            body
        );

        return result?.entry || result as any;
    }

    /**
     * Fetch notes for a specific lease
     * Convenience method that wraps fetch() with LEASEID filter
     */
    async fetchByLease(buildingId: string, leaseId: string): Promise<MriCommercialLeaseNote[]> {
        return this.fetch({
            BLDGID: buildingId,
            LEASEID: leaseId
        });
    }

    /**
     * Fetch notes modified since a specific date
     * Convenience method for getting recent updates
     */
    async fetchRecentUpdates(buildingId: string, since: Date): Promise<MriCommercialLeaseNote[]> {
        const dateStr = since.toISOString().replace('T', ' ').substring(0, 23);
        return this.fetch({
            BLDGID: buildingId,
            LASTUPDATEDATE: dateStr
        });
    }

    /**
     * Fetch notes created since a specific date
     * Convenience method for getting recent notes
     */
    async fetchRecentNotes(buildingId: string, since: Date): Promise<MriCommercialLeaseNote[]> {
        const dateStr = since.toISOString().replace('T', ' ').substring(0, 23);
        return this.fetch({
            BLDGID: buildingId,
            OLDESTNOTEDATE: dateStr
        });
    }
}
