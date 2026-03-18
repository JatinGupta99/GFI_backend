import { Renewal } from '../renewal.entity';

export interface RenewalData {
  tenantId: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  suite: string;
  sf: number;
  leaseEnd: Date;
  renewalOffer?: string;
  currentMonthRent: number;
  rentPerSf: number;
  budgetRent?: number;
  budgetRentPerSf?: number;
  budgetTI?: number;
  budgetLCD?: string;
  status: string;
  notes?: string;
  option: 'Yes' | 'No' | 'N/A';
  optionTerm?: string;
  mriLeaseId: string;
  mriData?: Record<string, any>;

  // MRI Report API fields (populated from 3-API sync)
  monthlyRent?: number;
  cam?: number;
  ins?: number;
  tax?: number;
  totalDueMonthly?: number;
  balanceForward?: number;
  cashReceived?: number;
  balanceDue?: number;
  days0To30?: string;
  days31To60?: string;
  days61Plus?: string;

  // Additional MRI fields
  leaseId?: string;
  legalName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  leaseStop?: string;
  origSqFt?: string;
  term?: string;
  billingEmailAddress?: string;
}

export interface RenewalProvider {
  fetchRenewals(propertyId: string): Promise<RenewalData[]>;
  fetchIncrementalRenewals(propertyId: string, since: Date): Promise<RenewalData[]>;
  validateConnection(): Promise<boolean>;
}

export interface RenewalReader {
  getRenewals(filters?: RenewalFilters): Promise<Renewal[]>;
  getRenewalsByProperty(propertyId: string): Promise<Renewal[]>;
  getUpcomingRenewals(daysAhead?: number): Promise<Renewal[]>;
  getRenewalById(id: string): Promise<Renewal | null>;
}

export interface RenewalSyncer {
  syncAllProperties(): Promise<SyncResult>;
  syncProperty(propertyId: string): Promise<SyncResult>;
  syncIncremental(since?: Date): Promise<SyncResult>;
}

export interface RenewalFilters {
  propertyIds?: string[];
  status?: string[];
  leaseEndBefore?: Date;
  leaseEndAfter?: Date;
  limit?: number;
  offset?: number;
}

export interface SyncResult {
  success: boolean;
  propertiesProcessed: number;
  renewalsUpdated: number;
  renewalsCreated: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}