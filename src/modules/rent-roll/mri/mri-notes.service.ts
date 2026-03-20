import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriNoteRaw {
    buildingId: string;
    leaseId: string;
    noteDate: string;
    reference1: string;
    reference2: string;
    lastUpdateDate: string;
    text: string;
    frequencyInMonths: number | null;
}

export interface CreateLeaseNoteDto {
    BuildingID: string;
    LeaseID: string;
    NoteDate: string;
    NoteText: string;
    NoteReference1: string;
    NoteReference2: string;
    Frequency?: number;
}

@Injectable()
export class MriNotesService {
    private readonly logger = new Logger(MriNotesService.name);

    constructor(private readonly mri: MriCoreService) { }

    /**
     * Fetch lease notes using MRI stored procedure
     * Stored Procedure: MRI_S-PMCM_LeaseNotes (GET)
     */
    async fetch(buildingId: string, leaseId: string): Promise<MriNoteRaw[]> {
        this.logger.debug(`Fetching notes | buildingId=${buildingId} leaseId=${leaseId}`);
        return this.mri.get<MriNoteRaw[]>('MRI_S-PMCM_LeaseNotes', { 
            BLDGID: buildingId,
            LEASEID: leaseId 
        });
    }

    /**
     * Create or update a lease note using MRI stored procedure
     * Stored Procedure: MRI_S-PMCM_LeaseNotes (PUT)
     * 
     * @param buildingId - The ID of the building associated with the lease
     * @param leaseId - The ID of the lease
     * @param noteDate - The date of the note (format: YYYY-MM-DD)
     * @param ref1 - Reference type 1 (use MRI_S-PMCM_ReferenceTypes API for valid values)
     * @param ref2 - Reference type 2 (use MRI_S-PMCM_ReferenceTypes API for valid values)
     * @param noteData - The note data to create/update
     */
    async createOrUpdate(
        buildingId: string,
        leaseId: string,
        noteDate: string,
        ref1: string,
        ref2: string,
        noteData: CreateLeaseNoteDto
    ): Promise<MriNoteRaw> {
        this.logger.debug(`Creating/updating note | buildingId=${buildingId} leaseId=${leaseId}`);
        
        const queryParams = {
            BUILDINGID: buildingId,
            LEASEID: leaseId,
            NOTEDATE: noteDate,
            REF1: ref1,
            REF2: ref2
        };

        const body = {
            entry: {
                BuildingID: noteData.BuildingID,
                LeaseID: noteData.LeaseID,
                NoteDate: noteData.NoteDate,
                NoteText: noteData.NoteText,
                NoteReference1: noteData.NoteReference1,
                NoteReference2: noteData.NoteReference2,
                Frequency: noteData.Frequency || 0
            }
        };

        return this.mri.put<MriNoteRaw>('MRI_S-PMCM_LeaseNotes', queryParams, body);
    }
}
