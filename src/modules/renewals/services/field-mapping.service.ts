import { Injectable, Logger } from '@nestjs/common';
import { MriOpenChargeRaw } from '../../rent-roll/mri/mri-open-charges.service';
import { MriTenantLedgerRaw } from '../../rent-roll/mri/mri-tenant-ledger.service';
import { MriCurrentDelinquencyRaw } from '../../rent-roll/mri/mri-current-delinquencies.service';

export interface MriReportFields {
  monthlyRent?: number;     // OpenCharges: IncomeCategory = RNT  TransactionAmount  (also TenantLedger fallback)
  cam?: number;             // OpenCharges: IncomeCategory = CAM  TransactionAmount
  ins?: number;             // OpenCharges: IncomeCategory = INS  TransactionAmount
  tax?: number;             // OpenCharges: RentTaxAmount (sum)
  totalDueMonthly?: number; // OpenCharges: TransactionAmount (all charges summed)
  balanceForward?: number;  // TenantLedger: OpenAmount for entries with period before current month
  cashReceived?: number;    // TenantLedger: sum of payment/receipt transactions (SourceCode = RC)
  balanceDue?: number;      // OpenCharges: OpenAmount (sum of all open amounts)
  days0To30?: string;       // CurrentDelinquencies: ThirtyDayDelinquency flag ('Y'/'N')
  days31To60?: string;      // CurrentDelinquencies: SixtyDayDelinquency flag ('Y'/'N')
  days61Plus?: string;      // CurrentDelinquencies: NinetyDayDelinquency OR NinetyPlusDayDelinquency flag
}

/**
 * Income category codes treated as base rent (case-insensitive).
 * Covers: RNT (standard), BRR (Base Rent Rate), BAS (Base Rent), RNT BASE RENT variants.
 */
const BASE_RENT_CATEGORIES = new Set(['RNT', 'BRR', 'BAS', 'BASE', 'RENT', 'BSRNT']);

/** SourceCodes that represent a payment receipt in the TenantLedger */
const PAYMENT_SOURCE_CODES = new Set(['RC', 'AR', 'CR']);

@Injectable()
export class FieldMappingService {
  private readonly logger = new Logger(FieldMappingService.name);

  /**
   * Map OpenCharges, TenantLedger, and CurrentDelinquencies raw API data
   * into the unified MriReportFields structure for the renewal document.
   */
  map(
    openCharges: MriOpenChargeRaw[],
    tenantLedger: MriTenantLedgerRaw[],
    delinquencies: MriCurrentDelinquencyRaw[],
    leaseId: string,
  ): MriReportFields {
    const fields: MriReportFields = {};

    try {
      this.logger.debug(
        `FieldMapping [${leaseId}]: openCharges=${openCharges.length}, tenantLedger=${tenantLedger.length}, delinquencies=${delinquencies.length}`,
      );

      // ── 1. OpenCharges → cam, ins, tax, totalDueMonthly, balanceDue, monthlyRent ──
      if (openCharges.length > 0) {
        let totalDue = 0;
        let totalOpen = 0;
        let cam = 0;
        let ins = 0;
        let totalTax = 0;
        let rntRent = 0; // base rent from OpenCharges (RNT category)

        for (const charge of openCharges) {
          const amount = this.toNumber(charge.TransactionAmount);
          const open = this.toNumber(charge.OpenAmount);
          const taxAmt = this.toNumber(charge.RentTaxAmount);
          const category = (charge.IncomeCategory ?? '').trim().toUpperCase();

          totalDue += amount;
          totalOpen += open;
          totalTax += taxAmt;

          if (category === 'CAM') cam += amount;
          else if (category === 'INS' || category === 'INSURANCE') ins += amount;
          
          // Base rent from OpenCharges
          if (BASE_RENT_CATEGORIES.has(category)) rntRent += amount;
        }

        if (cam !== 0) fields.cam = this.round(cam);
        if (ins !== 0) fields.ins = this.round(ins);
        if (totalTax !== 0) fields.tax = this.round(totalTax);
        if (totalDue !== 0) fields.totalDueMonthly = this.round(totalDue);
        if (totalOpen !== 0) fields.balanceDue = this.round(totalOpen);
        // Primary source for monthlyRent is OpenCharges RNT charge
        if (rntRent !== 0) fields.monthlyRent = this.round(rntRent);

        this.logger.debug(
          `FieldMapping [${leaseId}] OpenCharges result: cam=${fields.cam}, ins=${fields.ins}, tax=${fields.tax}, totalDue=${fields.totalDueMonthly}, balanceDue=${fields.balanceDue}, monthlyRent(OC)=${fields.monthlyRent}`,
        );
      } else {
        this.logger.warn(`FieldMapping [${leaseId}]: OpenCharges returned 0 entries - financial fields will be empty`);
      }

      // ── 2. TenantLedger → balanceForward, cashReceived, monthlyRent (fallback) ──
      if (tenantLedger.length > 0) {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let cashReceived = 0;
        let balanceForward = 0;
        let ledgerRent = 0; // base rent from TenantLedger (fallback)

        for (const entry of tenantLedger) {
          const sourceCode = (entry.SourceCode ?? '').trim().toUpperCase();
          const category = (entry.IncomeCategory ?? '').trim().toUpperCase();
          const amount = this.toNumber(entry.TransactionAmount);
          const open = this.toNumber(entry.OpenAmount);

          // Cash Received: entries with payment source codes
          if (PAYMENT_SOURCE_CODES.has(sourceCode)) {
            cashReceived += Math.abs(amount);
          }

          // Balance Forward: open amounts from periods before the current month
          const entryDate = entry.TransactionDate ? new Date(entry.TransactionDate) : null;
          if (entryDate && entryDate < currentMonthStart && open !== 0) {
            balanceForward += open;
          }

          // TenantLedger monthly rent (used as fallback if OpenCharges didn't provide it)
          if (BASE_RENT_CATEGORIES.has(category) && sourceCode !== 'RC') {
            ledgerRent += Math.abs(amount);
          }
        }

        if (cashReceived !== 0) fields.cashReceived = this.round(cashReceived);
        if (balanceForward !== 0) fields.balanceForward = this.round(balanceForward);
        // Only use ledger rent if OpenCharges didn't give us a monthlyRent
        if (!fields.monthlyRent && ledgerRent !== 0) fields.monthlyRent = this.round(ledgerRent);

        this.logger.debug(
          `FieldMapping [${leaseId}] TenantLedger result: cashReceived=${fields.cashReceived}, balanceForward=${fields.balanceForward}, monthlyRent(ledger)=${ledgerRent}`,
        );
      } else {
        this.logger.warn(`FieldMapping [${leaseId}]: TenantLedger returned 0 entries - payment history fields will be empty`);
      }

      // ── 3. CurrentDelinquencies → aging bucket flags ──
      if (delinquencies.length > 0) {
        // Aggregate across all delinquency entries for this lease
        let has30 = false, has60 = false, has90plus = false;
        for (const d of delinquencies) {
          if (d.ThirtyDayDelinquency === 'Y') has30 = true;
          if (d.SixtyDayDelinquency === 'Y') has60 = true;
          if (d.NinetyDayDelinquency === 'Y' || d.NinetyPlusDayDelinquency === 'Y') has90plus = true;
        }
        fields.days0To30 = has30 ? 'Y' : 'N';
        fields.days31To60 = has60 ? 'Y' : 'N';
        fields.days61Plus = has90plus ? 'Y' : 'N';
      }

    } catch (error) {
      this.logger.error(`FieldMappingService: error mapping data for lease ${leaseId}: ${error.message}`, error.stack);
    }

    this.logger.log(`FieldMapping [${leaseId}] FINAL: ${JSON.stringify(fields)}`);
    return fields;
  }

  private toNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const n = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
