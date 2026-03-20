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

export interface TenantLedgerCalculations {
  balanceForward: number;        // Balance from previous month
  cashReceived: number;          // Cash received in current month
  monthlyRent: number;           // Base rent charges for current month
  cam: number;                   // CAM charges for current month
  ins: number;                   // Insurance charges for current month
  tax: number;                   // Tax charges for current month
  days0To30: number;             // 0-30 day aging
  days31To60: number;            // 31-60 day aging
  days61Plus: number;            // 61+ day aging
  totalArBalance: number;        // Total AR balance
}

@Injectable()
export class MriTenantLedgerService {
  private readonly logger = new Logger(MriTenantLedgerService.name);

  constructor(private readonly mri: MriCoreService) {}

  /**
   * Fetch tenant ledger entries for a building/lease within an optional date range.
   * Uses MRI_S-PMCM_TenantLedger API.
   * 
   * Recommended approach: Fetch full history (STARTDATE=1900-01-01, ENDDATE=today)
   * and filter in-memory for better accounting accuracy.
   */
  async fetch(
    buildingId: string,
    leaseId?: string,
    startDate?: string,
    endDate?: string,
    lastUpdateDate?: string,
  ): Promise<MriTenantLedgerRaw[]> {
    this.logger.debug(
      `Fetching tenant ledger | buildingId=${buildingId} leaseId=${leaseId ?? 'ALL'} startDate=${startDate ?? '-'} endDate=${endDate ?? '-'}`,
    );

    const params: Record<string, string> = { BLDGID: buildingId };
    if (leaseId) params.LEASEID = leaseId;
    if (startDate) params.STARTDATE = startDate;
    if (endDate) params.ENDDATE = endDate;
    if (lastUpdateDate) params.LastUpDate = lastUpdateDate;

    const results: MriTenantLedgerRaw[] = [];
    let skip = 0;
    const top = 300;

    while (true) {
      const page = await this.mri.get<MriTenantLedgerRaw[]>('MRI_S-PMCM_TenantLedger', {
        ...params,
        '$top': top.toString(),
        '$skip': skip.toString(),
      });

      if (!page?.length) break;
      results.push(...page);
      if (page.length < top) break;
      skip += top;
    }

    this.logger.log(`✅ TenantLedger fetched: ${results.length} records for building ${buildingId} lease ${leaseId ?? 'ALL'}`);
    return results;
  }

  /**
   * Calculate all financial metrics from tenant ledger data
   * Uses the hybrid approach: fetch full history once, filter in-memory
   * 
   * @param buildingId - Building ID
   * @param leaseId - Lease ID
   * @param currentMonthStart - Start of current month (e.g., '2026-03-01')
   * @param currentMonthEnd - End of current month (e.g., '2026-03-31')
   * @param previousMonthEnd - End of previous month (e.g., '2026-02-28')
   */
  async calculateFinancials(
    buildingId: string,
    leaseId: string,
    currentMonthStart: string,
    currentMonthEnd: string,
    previousMonthEnd: string,
  ): Promise<TenantLedgerCalculations> {
    this.logger.debug(`Calculating financials for lease ${leaseId} in building ${buildingId}`);

    // Fetch full history (recommended approach for accounting accuracy)
    const allTransactions = await this.fetch(
      buildingId,
      leaseId,
      '1900-01-01',
      currentMonthEnd,
    );

    if (!allTransactions.length) {
      this.logger.warn(`No tenant ledger data found for lease ${leaseId}`);
      return {
        balanceForward: 0,
        cashReceived: 0,
        monthlyRent: 0,
        cam: 0,
        ins: 0,
        tax: 0,
        days0To30: 0,
        days31To60: 0,
        days61Plus: 0,
        totalArBalance: 0,
      };
    }

    // 1. Balance Forward (1-31 days) - Previous month history
    const balanceForward = this.calculateBalanceForward(
      allTransactions,
      previousMonthEnd,
    );

    // 2. Cash Received - Current month receipts
    const cashReceived = this.calculateCashReceived(
      allTransactions,
      currentMonthStart,
      currentMonthEnd,
    );

    // 3. Monthly charges (INS, CAM, TAX, BaseRent) - Current month charges
    const monthlyCharges = this.calculateMonthlyCharges(
      allTransactions,
      currentMonthStart,
      currentMonthEnd,
    );

    // 4. Aging Buckets - All unpaid transactions
    const aging = this.calculateAging(
      allTransactions,
      currentMonthEnd,
    );

    this.logger.log(`✅ Financials calculated for lease ${leaseId}: balanceForward=${balanceForward}, cashReceived=${cashReceived}, totalAR=${aging.totalArBalance}`);

    return {
      balanceForward,
      cashReceived,
      monthlyRent: monthlyCharges.baseRent,
      cam: monthlyCharges.cam,
      ins: monthlyCharges.ins,
      tax: monthlyCharges.tax,
      days0To30: aging.days0To30,
      days31To60: aging.days31To60,
      days61Plus: aging.days61Plus,
      totalArBalance: aging.totalArBalance,
    };
  }

  /**
   * Calculate Balance Forward from previous month
   * Running sum of all transactions up to end of previous month
   */
  private calculateBalanceForward(
    transactions: MriTenantLedgerRaw[],
    previousMonthEnd: string,
  ): number {
    const previousMonthDate = new Date(previousMonthEnd);
    
    let balance = 0;
    for (const tx of transactions) {
      const txDate = new Date(tx.TransactionDate);
      if (txDate <= previousMonthDate) {
        // Charges increase balance, receipts decrease balance
        if (tx.SourceCode === 'CH') {
          balance += tx.TransactionAmount;
        } else if (tx.SourceCode === 'CR') {
          balance -= tx.TransactionAmount;
        }
      }
    }

    return balance;
  }

  /**
   * Calculate Cash Received in current month
   * Sum of all receipts (SourceCode = 'CR') in current month
   */
  private calculateCashReceived(
    transactions: MriTenantLedgerRaw[],
    monthStart: string,
    monthEnd: string,
  ): number {
    const startDate = new Date(monthStart);
    const endDate = new Date(monthEnd);

    let cashReceived = 0;
    for (const tx of transactions) {
      const txDate = new Date(tx.TransactionDate);
      if (txDate >= startDate && txDate <= endDate && tx.SourceCode === 'CR') {
        cashReceived += tx.TransactionAmount;
      }
    }

    return cashReceived;
  }

  /**
   * Calculate monthly charges by income category
   * Filter by current month and SourceCode = 'CH'
   */
  private calculateMonthlyCharges(
    transactions: MriTenantLedgerRaw[],
    monthStart: string,
    monthEnd: string,
  ): { baseRent: number; cam: number; ins: number; tax: number } {
    const startDate = new Date(monthStart);
    const endDate = new Date(monthEnd);

    let baseRent = 0;
    let cam = 0;
    let ins = 0;
    let tax = 0;

    for (const tx of transactions) {
      const txDate = new Date(tx.TransactionDate);
      if (txDate >= startDate && txDate <= endDate && tx.SourceCode === 'CH') {
        const category = tx.IncomeCategory?.toUpperCase() || '';
        
        if (['BRR', 'RNT', 'RENT', 'BASE'].includes(category)) {
          baseRent += tx.TransactionAmount;
        } else if (category === 'CAM') {
          cam += tx.TransactionAmount;
        } else if (category === 'INS') {
          ins += tx.TransactionAmount;
        } else if (['RET', 'STX', 'TAX'].includes(category)) {
          tax += tx.TransactionAmount;
        }
      }
    }

    return { baseRent, cam, ins, tax };
  }

  /**
   * Calculate aging buckets from all unpaid transactions
   * Filter by OpenAmount > 0 and categorize by transaction date
   */
  private calculateAging(
    transactions: MriTenantLedgerRaw[],
    asOfDate: string,
  ): { days0To30: number; days31To60: number; days61Plus: number; totalArBalance: number } {
    const today = new Date(asOfDate);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(today.getDate() - 60);

    let days0To30 = 0;
    let days31To60 = 0;
    let days61Plus = 0;
    let totalArBalance = 0;

    for (const tx of transactions) {
      const openAmount = tx.OpenAmount || 0;
      if (openAmount > 0) {
        const txDate = new Date(tx.TransactionDate);
        totalArBalance += openAmount;

        // Categorize by age
        if (txDate >= thirtyDaysAgo) {
          days0To30 += openAmount;
        } else if (txDate >= sixtyDaysAgo) {
          days31To60 += openAmount;
        } else {
          days61Plus += openAmount;
        }
      }
    }

    return { days0To30, days31To60, days61Plus, totalArBalance };
  }
}
