import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriArRaw {
    MasterOccupantID: string;
    Balance: number;
    AgeBuckets: any; // Simplified for now
}

@Injectable()
export class MriArService {
    private readonly logger = new Logger(MriArService.name);

    constructor(private readonly mri: MriCoreService) { }

    async fetch(masterOccupantId: string): Promise<MriArRaw[]> {
        this.logger.debug(`Fetching AR | masterOccupantId=${masterOccupantId}`);
        return this.mri.get<MriArRaw[]>('MRI_S-PMCM_OpenARByOccupant', { MasterOccupantID: masterOccupantId });
    }
}
