import { Injectable, Logger } from '@nestjs/common';
import { MriCoreService } from './mri-core.service';

export interface MriTenantLedgerRaw {
  TransactionID: string;
  BuildingID: string;
  LeaseID: string;
  TransactionDate: string;
  IncomeCategory: string;
  SourceCode: string;
  CashType: string;           // 'OP' = open charge, 'RC' = receipt/payment
  Description: string;
  TransactionAmount: number;
  OpenAmount: number;
  ReceiptDescriptor: string;
  ReferenceTransactionID: string;
  RentTaxID: string;
  RentTaxAmount: number;
  BankID: string;
  ReceiptNumber: string;
  ReceiptTransactionNumber: string;
  RentTaxGroupID: string;
  Department: string;
  CurrencyCode: string;
  ReceiptTypeID: string;
  Period: string;
  ProgramName: string;
  AdditionalDescription: string;
  PartnerName: string;
  ParentTransactionID: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  PartnerTransactionNumber: string;
  CMBatchID: string;
}

@Injectable()
export class MriTenantLedgerService {
  private readonly logger = new Logger(MriTenantLedgerService.name);

  constructor(private readonly mri: MriCoreService) {}

  /**
   * Fetch tenant ledger entries for a building/lease within an optional date range.
   * Uses MRI_S-PMCM_TenantLedger API.
   */
  async fetch(
    buildingId: string,
    leaseId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<MriTenantLedgerRaw[]> {
    this.logger.debug(
      `Fetching tenant ledger | buildingId=${buildingId} leaseId=${leaseId ?? 'ALL'} startDate=${startDate ?? '-'} endDate=${endDate ?? '-'}`,
    );

    const params: Record<string, string> = { BLDGID: buildingId };
    if (leaseId) params.LEASEID = leaseId;
    if (startDate) params.STARTDATE = startDate;
    if (endDate) params.ENDDATE = endDate;

    const results: MriTenantLedgerRaw[] = [];
    let skip = 0;
    const top = 300;

    while (true) {
      const page = await this.mri.get<MriTenantLedgerRaw[]>('MRI_S-PMCM_TenantLedger', {
        ...params,
        '$top': top,
        '$skip': skip,
      });

      if (!page?.length) break;
      results.push(...page);
      if (page.length < top) break;
      skip += top;
    }

    this.logger.log(`✅ TenantLedger fetched: ${results.length} records for building ${buildingId} lease ${leaseId ?? 'ALL'}`);
    return results;
  }
}
