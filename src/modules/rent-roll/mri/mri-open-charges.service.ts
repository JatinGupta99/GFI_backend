import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriOpenChargeRaw {
  BuildingID: string;
  LeaseID: string;
  TransactionID: string;
  Description: string;
  TransactionAmount: number;
  OpenAmount: number;
  IncomeCategory: string;
  IncomeCategoryDescription: string;
  PendingAmount: number;
  CashType: string;
  TransactionDate: string;
  Period: string;
  AdditionalDescription: string;
  ProgramName: string;
  CMInvoiceNumber: string;
  BankID: string;
  ParentTransactionID: string;
  RentTaxID: string;
  RentTaxGroupID: string;
  RentTaxAmount: number;
  CMBatchID: string;
  PendingAdjustmentAmount: number;
}

@Injectable()
export class MriOpenChargesService {
  private readonly logger = new Logger(MriOpenChargesService.name);

  constructor(private readonly mri: MriCoreService) {}

  /**
   * Fetch all open charges for a building/lease.
   * Uses MRI_S-PMCM_OpenCharges API.
   */
  async fetch(buildingId: string, leaseId?: string, incomeCategories?: string[]): Promise<MriOpenChargeRaw[]> {
    this.logger.debug(
      `Fetching open charges | buildingId=${buildingId} leaseId=${leaseId ?? 'ALL'} incomeCategories=${incomeCategories?.join(',') ?? 'ALL'}`,
    );

    const params: Record<string, string> = { BuildingID: buildingId };
    if (leaseId) params.LeaseID = leaseId;
    if (incomeCategories?.length) params.IncomeCategories = incomeCategories.join(',');

    const results: MriOpenChargeRaw[] = [];
    let skip = 0;
    const top = 300;

    // Paginate through all results
    while (true) {
      const page = await this.mri.get<MriOpenChargeRaw[]>('MRI_S-PMCM_OpenCharges', {
        ...params,
        '$top': top,
        '$skip': skip,
      });

      if (!page?.length) break;
      results.push(...page);
      if (page.length < top) break; // last page
      skip += top;
    }

    this.logger.log(`✅ OpenCharges fetched: ${results.length} records for building ${buildingId} lease ${leaseId ?? 'ALL'}`);
    return results;
  }
}
