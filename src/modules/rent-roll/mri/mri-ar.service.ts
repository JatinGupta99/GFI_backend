import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriArRaw {
    MasterOccupantID: string;
    Balance: number;
    AgeBuckets: any; // Simplified for now
}

@Injectable()
export class MriArService {
    constructor(private readonly mri: MriCoreService) { }

    async fetch(masterOccupantId: string): Promise<MriArRaw[]> {
        return this.mri.get<MriArRaw[]>('MRI_S-PMCM_OpenARByOccupant', { MasterOccupantID: masterOccupantId });
    }
}
