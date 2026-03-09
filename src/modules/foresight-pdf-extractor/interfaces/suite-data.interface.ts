import { FinancialChargesInterface } from './financial-charges.interface';
import { LeaseTermsInterface } from './lease-terms.interface';
import { MonthlyPaymentsInterface } from './monthly-payments.interface';

export interface SuiteDataInterface {
  suiteId: string;
  charges: FinancialChargesInterface;
  balanceDue: number;
  leaseTerms: LeaseTermsInterface;
  monthlyPayments: MonthlyPaymentsInterface;
}
