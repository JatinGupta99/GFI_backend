import { Injectable } from '@nestjs/common';
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

@Injectable()
export class MriNotesService {
    constructor(private readonly mri: MriCoreService) { }

    /**
     * info: Uses the new RESTful API for CM Lease Notes
     * Routes: GET /api/applications/Integrations/CM/Leases/Notes/{buildingId}?leaseId=
     */
    async fetch(buildingId: string, leaseId: string): Promise<MriNoteRaw[]> {
        const path = `api/applications/Integrations/CM/Leases/Notes/${buildingId}`;
        return this.mri.getRest<MriNoteRaw[]>(path, { leaseId });
    }
}
