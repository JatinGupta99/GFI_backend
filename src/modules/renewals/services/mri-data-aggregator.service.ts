import { Injectable, Logger } from '@nestjs/common';
import { MriChargesService, MriChargeData } from './mri-charges.service';
import { MriFinancialService, MriDelinquencyData, MriTenantLedgerData } from './mri-financial.service';

export interface AggregatedMriData {
  // Rent Components (calculated from all recurring charges)
  monthlyRent?: number;
  cam?: number;
  ins?: number;
  tax?: number;
  totalDueMonthly?: number; // Sum of ALL recurring monthly charges
  
  // Financial Data (from correct API sources)
  balanceForward?: number;    // From TenantLedger
  cashReceived?: number;      // From TenantLedger
  balanceDue?: number;        // From CurrentDelinquencies - OpenCredits
  totalArBalance?: number;    // From CommercialLedger
  
  // Aging Buckets (from CurrentDelinquencies)
  days0To30?: number;
  days31To60?: number;
  days61Plus?: number;
  
  // Budget Information (from LeaseEMEA)
  budgetRent?: number;
  budgetRentPerSf?: number;
  budgetTI?: number;
  
  // Escalations
  rentEscalations?: Record<string, number>;
  
  // Raw Data for debugging
  rawData: {
    charges: MriChargeData[];
    annualRent: any[];
    delinquencies: MriDelinquencyData[];
    tenantLedger: MriTenantLedgerData[];
    commercialLedger: any[];
    openCharges: any[];
    openCredits: any[];
    leaseBudget: any[];
  };
}

export interface OpenCreditData {
  LeaseID: string;
  OpenAmount: number;
  CreditType?: string;
  Description?: string;
}

@Injectable()
export class MriDataAggregatorService {
  private readonly logger = new Logger(MriDataAggregatorService.name);

  constructor(
    private readonly chargesService: MriChargesService,
    private readonly financialService: MriFinancialService,
  ) {}

  /**
   * Complete MRI data aggregation following the correct financial pipeline
   * Calls all 8 required MRI APIs and properly calculates financial metrics
   */
  async aggregateLeaseData(propertyId: string, leaseId: string): Promise<AggregatedMriData> {
    const startTime = Date.now();
    this.logger.log(`🔄 Starting complete data aggregation for lease ${leaseId} in property ${propertyId}`);

    // Calculate date range for financial data (12 months back)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const startDate = twelveMonthsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    try {
      // Fetch ALL required data in parallel (8 API calls)
      const [
        charges,
        annualRent,
        delinquencies,
        tenantLedger,
        openCharges,
        commercialLedger,
        openCredits,
        leaseBudget
      ] = await Promise.all([
        this.chargesService.getRecurringCharges(propertyId, leaseId),
        this.chargesService.getAnnualRentData(propertyId, leaseId),
        this.financialService.getCurrentDelinquencies(propertyId, leaseId),
        this.financialService.getTenantLedger(propertyId, leaseId, startDate, endDate),
        this.financialService.getOpenCharges(propertyId, leaseId),
        this.financialService.getCommercialLedger(propertyId, leaseId, startDate, endDate),
        this.financialService.getOpenCredits(propertyId, leaseId),
        this.financialService.getLeaseBudget(propertyId, leaseId)
      ]);

      // Build the complete renewal document
      const aggregatedData = this.buildRenewalDocument(
        charges,
        annualRent,
        delinquencies,
        tenantLedger,
        openCharges,
        commercialLedger,
        openCredits,
        leaseBudget
      );

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Complete data aggregation finished for lease ${leaseId} in ${duration}ms`);

      return {
        ...aggregatedData,
        rawData: {
          charges,
          annualRent,
          delinquencies,
          tenantLedger,
          commercialLedger,
          openCharges,
          openCredits,
          leaseBudget
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Complete data aggregation failed for lease ${leaseId} after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the complete renewal document from all MRI data sources
   */
  private buildRenewalDocument(
    charges: MriChargeData[],
    annualRent: any[],
    delinquencies: MriDelinquencyData[],
    tenantLedger: MriTenantLedgerData[],
    openCharges: any[],
    commercialLedger: any[],
    openCredits: any[],
    leaseBudget: any[]
  ): Partial<AggregatedMriData> {
    const result: Partial<AggregatedMriData> = {};

    // 1. Process ALL recurring charges (FIXED: sum all monthly charges, not just 4 categories)
    this.processAllRecurringCharges(charges, result);

    // 2. Process annual rent data for base rent validation
    this.processAnnualRent(annualRent, result);

    // 3. Process delinquencies for aging buckets and base balance due
    this.processDelinquencies(delinquencies, result);

    // 4. Process tenant ledger for balance forward and cash received
    this.processTenantLedger(tenantLedger, result);

    // 5. Process open charges for current charges
    this.processOpenCharges(openCharges, result);

    // 6. Process commercial ledger for total AR balance
    this.processCommercialLedger(commercialLedger, result);

    // 7. Process open credits and calculate correct balance due (FIXED)
    this.processOpenCreditsAndCalculateBalanceDue(openCredits, result);

    // 8. Process lease budget information
    this.processLeaseBudget(leaseBudget, result);

    // 9. Final calculations and validations
    this.performFinalCalculations(result);

    return result;
  }

  /**
   * FIXED: Process ALL recurring charges, not just 4 categories
   * Sum all charges where Frequency = 'M' (Monthly)
   */
  private processAllRecurringCharges(charges: MriChargeData[], result: Partial<AggregatedMriData>): void {
    let totalMonthlyCharges = 0;
    const categoryTotals: Record<string, number> = {};

    charges.forEach(charge => {
      if (!charge.CurrentlyInEffect) return;

      const amount = charge.Amount || 0;
      const monthlyAmount = this.convertToMonthly(amount, charge.Frequency);

      // Only include monthly recurring charges in total
      if (charge.Frequency?.toUpperCase() === 'M') {
        totalMonthlyCharges += monthlyAmount;
      }

      // Track specific categories for detailed breakdown
      const category = charge.IncomeCategoryDescription?.toUpperCase();
      if (category) {
        categoryTotals[category] = (categoryTotals[category] || 0) + monthlyAmount;

        // Map known categories to specific fields
        switch (category) {
          case 'RNT':
          case 'RENT':
            result.monthlyRent = monthlyAmount;
            break;
          case 'CAM':
            result.cam = monthlyAmount;
            break;
          case 'INS':
          case 'INSURANCE':
            result.ins = monthlyAmount;
            break;
          case 'TAX':
          case 'TAXES':
            result.tax = monthlyAmount;
            break;
          // Additional categories that should be included in total
          case 'UTIL':
          case 'HVAC':
          case 'ELEC':
          case 'PARK':
          case 'MISC':
            // These are included in totalMonthlyCharges but don't have specific fields
            break;
        }
      }
    });

    // FIXED: Use sum of all recurring charges, not just 4 categories
    result.totalDueMonthly = totalMonthlyCharges;

    this.logger.debug(`💰 Processed ${charges.length} charges, total monthly: $${totalMonthlyCharges}`);
    this.logger.debug(`📊 Category breakdown: ${JSON.stringify(categoryTotals)}`);
  }

  private processAnnualRent(annualRent: any[], result: Partial<AggregatedMriData>): void {
    if (annualRent.length > 0) {
      const rentRecord = annualRent[0];
      // Use as fallback if not set from charges
      if (!result.monthlyRent && rentRecord.MonthlyAmount) {
        result.monthlyRent = rentRecord.MonthlyAmount;
      }
    }
  }

  /**
   * FIXED: Process delinquencies correctly for aging buckets
   */
  private processDelinquencies(delinquencies: MriDelinquencyData[], result: Partial<AggregatedMriData>): void {
    if (delinquencies.length > 0) {
      const delinq = delinquencies[0];
      
      // Store base delinquent amount (will be adjusted by open credits later)
      const baseDelinquentAmount = delinq.DelinquentAmount || 0;
      result.balanceDue = baseDelinquentAmount;
      
      // Aging buckets
      result.days0To30 = delinq.ThirtyDayDelinquency || 0;
      result.days31To60 = delinq.SixtyDayDelinquency || 0;
      result.days61Plus = (delinq.NinetyDayDelinquency || 0) + (delinq.NinetyPlusDayDelinquency || 0);

      this.logger.debug(`💳 Base delinquent amount: $${baseDelinquentAmount}`);
    }
  }

  /**
   * FIXED: Process tenant ledger for balance forward and cash received
   */
  private processTenantLedger(ledger: MriTenantLedgerData[], result: Partial<AggregatedMriData>): void {
    if (ledger.length === 0) return;

    // Sort by transaction date
    const sortedLedger = ledger.sort((a, b) => 
      new Date(a.TransactionDate).getTime() - new Date(b.TransactionDate).getTime()
    );

    // Balance forward from oldest entry
    if (sortedLedger[0]) {
      result.balanceForward = sortedLedger[0].Balance || 0;
    }

    // Cash received from payment transactions
    const payments = ledger.filter(entry => 
      entry.TransactionType?.toLowerCase().includes('payment') ||
      entry.TransactionType?.toLowerCase().includes('receipt') ||
      entry.Amount < 0 // Negative amounts are typically payments
    );
    
    result.cashReceived = Math.abs(payments.reduce((sum, payment) => sum + (payment.Amount || 0), 0));

    this.logger.debug(`💰 Balance forward: $${result.balanceForward}, Cash received: $${result.cashReceived}`);
  }

  private processOpenCharges(openCharges: any[], result: Partial<AggregatedMriData>): void {
    // Process current open charges if needed
    // This data can be used for additional validation or reporting
    this.logger.debug(`📋 Processed ${openCharges.length} open charges`);
  }

  /**
   * FIXED: Process commercial ledger for total AR balance
   */
  private processCommercialLedger(commercialLedger: any[], result: Partial<AggregatedMriData>): void {
    if (commercialLedger.length > 0) {
      // Calculate total AR balance from commercial ledger
      const totalBalance = commercialLedger.reduce((sum, entry) => {
        return sum + (entry.Balance || entry.Amount || 0);
      }, 0);
      
      result.totalArBalance = totalBalance;

      this.logger.debug(`💼 Total AR balance from commercial ledger: $${totalBalance}`);
    }
  }

  /**
   * FIXED: Process open credits and calculate correct balance due
   * balanceDue = delinquentAmount - sum(openCredits.OpenAmount)
   */
  private processOpenCreditsAndCalculateBalanceDue(openCredits: any[], result: Partial<AggregatedMriData>): void {
    const totalCredits = openCredits.reduce((sum, credit) => {
      return sum + (credit.OpenAmount || credit.Amount || 0);
    }, 0);

    // FIXED: Correct balance due calculation
    if (result.balanceDue !== undefined) {
      const originalBalance = result.balanceDue;
      result.balanceDue = Math.max(0, originalBalance - totalCredits);
      
      this.logger.debug(`💳 Balance due calculation: $${originalBalance} - $${totalCredits} = $${result.balanceDue}`);
    }

    // Update total AR balance if credits affect it
    if (result.totalArBalance !== undefined && totalCredits > 0) {
      result.totalArBalance = Math.max(0, result.totalArBalance - totalCredits);
    }
  }

  private processLeaseBudget(leaseBudget: any[], result: Partial<AggregatedMriData>): void {
    if (leaseBudget.length > 0) {
      const budget = leaseBudget[0];
      result.budgetRent = budget.BudgetRent || budget.MonthlyRent;
      result.budgetRentPerSf = budget.BudgetRentPerSF || budget.RentPerSF;
      result.budgetTI = budget.TenantImprovements || budget.TI;
    }
  }

  /**
   * Final calculations and validations
   */
  private performFinalCalculations(result: Partial<AggregatedMriData>): void {
    // Ensure totalDueMonthly is set (fallback to sum of known categories)
    if (!result.totalDueMonthly) {
      result.totalDueMonthly = 
        (result.monthlyRent || 0) +
        (result.cam || 0) +
        (result.ins || 0) +
        (result.tax || 0);
    }

    // Set total AR balance fallback
    if (!result.totalArBalance) {
      result.totalArBalance = result.balanceDue || 0;
    }

    // Validate calculations
    this.validateCalculations(result);
  }

  private validateCalculations(result: Partial<AggregatedMriData>): void {
    // Log warnings for potential data issues
    if ((result.balanceDue || 0) < 0) {
      this.logger.warn(`⚠️  Negative balance due detected: $${result.balanceDue}`);
    }

    if ((result.totalDueMonthly || 0) <= 0) {
      this.logger.warn(`⚠️  Zero or negative total due monthly: $${result.totalDueMonthly}`);
    }

    if ((result.totalArBalance || 0) !== (result.balanceDue || 0)) {
      this.logger.debug(`ℹ️  AR balance ($${result.totalArBalance}) differs from balance due ($${result.balanceDue})`);
    }
  }

  private convertToMonthly(amount: number, frequency: string): number {
    if (!frequency) return amount;

    switch (frequency.toUpperCase()) {
      case 'M':
      case 'MONTHLY':
        return amount;
      case 'A':
      case 'ANNUAL':
      case 'YEARLY':
        return amount / 12;
      case 'Q':
      case 'QUARTERLY':
        return amount / 3;
      case 'S':
      case 'SEMI-ANNUAL':
        return amount / 6;
      default:
        this.logger.warn(`⚠️  Unknown frequency: ${frequency}, treating as monthly`);
        return amount;
    }
  }
}