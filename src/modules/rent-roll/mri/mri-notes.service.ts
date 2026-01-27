import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriNoteRaw {
    LeaseID: string;
    NoteText: string;
    Date: string;
}

@Injectable()
export class MriNotesService {
    constructor(private readonly mri: MriCoreService) { }

    async fetch(leaseId: string): Promise<MriNoteRaw[]> {
        return this.mri.get<MriNoteRaw[]>('MRI_S-PMCM_LeaseNotes', { LeaseID: leaseId });
    }
}
