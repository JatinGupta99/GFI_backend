import { Injectable } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriOptionRaw {
    LeaseID: string;
    OptionType: string;
    StartDate: string;
    EndDate: string;
}

@Injectable()
export class MriOptionsService {
    constructor(private readonly mri: MriCoreService) { }

    async fetch(leaseId: string): Promise<MriOptionRaw[]> {
        return this.mri.get<MriOptionRaw[]>('MRI_S-PMCRE_LeaseOptions', { LeaseID: leaseId });
    }
}
