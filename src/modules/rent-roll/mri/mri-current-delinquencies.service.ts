import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriCurrentDelinquencyRaw {
  BuildingID: string;
  LeaseID: string;
  SuiteID: string;
  OccupantName: string;
  EmailAddress: string;
  OccupancyStatus: string;
  ThirtyDayDelinquency: string;       // 'Y' or 'N' flag
  SixtyDayDelinquency: string;        // 'Y' or 'N' flag
  NinetyDayDelinquency: string;       // 'Y' or 'N' flag
  NinetyPlusDayDelinquency: string;   // 'Y' or 'N' flag
  DelinquentAmount: number;
  TotalDelinquency: number;           // Number of days charge has been open
  PrepaidCharges: number;
  ChargeDescription: string;
  ChargeDate: string;
  IncomeCategory: string;
  TransactionSourceCode: string;
  CMInvoiceNumber: string;
  MasterOccupantID: string;
}

@Injectable()
export class MriCurrentDelinquenciesService {
  private readonly logger = new Logger(MriCurrentDelinquenciesService.name);

  constructor(private readonly mri: MriCoreService) {}

  /**
   * Fetch current delinquencies for a building/lease.
   * Uses MRI_S-PMCM_CurrentDelinquencies API.
   */
  async fetch(buildingId: string, leaseId?: string): Promise<MriCurrentDelinquencyRaw[]> {
    this.logger.debug(
      `Fetching current delinquencies | buildingId=${buildingId} leaseId=${leaseId ?? 'ALL'}`,
    );

    const params: Record<string, string> = { BuildingID: buildingId };
    if (leaseId) params.LeaseID = leaseId;

    const result = await this.mri.get<MriCurrentDelinquencyRaw[]>(
      'MRI_S-PMCM_CurrentDelinquencies',
      params,
    );

    const records = result ?? [];
    this.logger.log(`✅ CurrentDelinquencies fetched: ${records.length} records for building ${buildingId} lease ${leaseId ?? 'ALL'}`);
    return records;
  }
}
