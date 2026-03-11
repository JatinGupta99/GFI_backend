import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RenewalProvider, RenewalData } from '../interfaces/renewal-provider.interface';
import { MriLeasesService } from '../../rent-roll/mri/mri-leases.service';
import { MriRenewalOffersService } from '../../rent-roll/mri/mri-renewal-offers.service';
import { MriLeaseEmeaService } from '../../rent-roll/mri/mri-lease-emea.service';
import { MriOpenChargesService } from '../../rent-roll/mri/mri-open-charges.service';
import { MriTenantLedgerService } from '../../rent-roll/mri/mri-tenant-ledger.service';
import { MriCurrentDelinquenciesService } from '../../rent-roll/mri/mri-current-delinquencies.service';
import { FieldMappingService } from '../services/field-mapping.service';
import { RateLimiterService } from '../services/rate-limiter.service';

@Injectable()
export class MriRenewalProvider implements RenewalProvider {
  private readonly logger = new Logger(MriRenewalProvider.name);
  private readonly rateLimiter: RateLimiterService;
  private readonly renewalWindowMonthsBefore: number;
  private readonly renewalWindowMonthsAfter: number;
  private readonly includeAllActive: boolean;

  constructor(
    private readonly leasesService: MriLeasesService,
    private readonly renewalOffersService: MriRenewalOffersService,
    private readonly emeaService: MriLeaseEmeaService,
    private readonly openChargesService: MriOpenChargesService,
    private readonly tenantLedgerService: MriTenantLedgerService,
    private readonly currentDelinquenciesService: MriCurrentDelinquenciesService,
    private readonly fieldMappingService: FieldMappingService,
    private readonly configService: ConfigService,
  ) {
    // Configure rate limiter for MRI API limits
    // 2500 calls / 5 minutes = ~8 calls per second
    this.rateLimiter = new RateLimiterService({
      maxConcurrent: 8,           // Max 8 concurrent requests
      minTime: 120,               // 120ms between requests
      maxRequestsPerWindow: 2400, // 2400 calls per window (buffer for safety)
      windowMs: 5 * 60 * 1000,    // 5 minute window
    });

    // Load renewal window configuration
    this.renewalWindowMonthsBefore = this.configService.get<number>('renewals.windowMonthsBefore', 36);
    this.renewalWindowMonthsAfter = this.configService.get<number>('renewals.windowMonthsAfter', 6);
    this.includeAllActive = this.configService.get<boolean>('renewals.includeAllActive', false);

    // Force console output to ensure we see configuration
    console.log(`\n========== MRI RENEWAL PROVIDER INITIALIZED ==========`);
    console.log(`Window Before: ${this.renewalWindowMonthsBefore} months`);
    console.log(`Window After: ${this.renewalWindowMonthsAfter} months`);
    console.log(`Include All Active: ${this.includeAllActive}`);
    console.log(`======================================================\n`);

    this.logger.log(`🔧 Renewal window configured: ${this.renewalWindowMonthsAfter} months after to ${this.renewalWindowMonthsBefore} months before expiration`);
    if (this.includeAllActive) {
      this.logger.log(`🔧 Including ALL active leases (ignoring window)`);
    }
  }

  async fetchRenewals(propertyId: string): Promise<RenewalData[]> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🔄 Starting renewal fetch for property ${propertyId}`);
      
      // Step 1: Get all tenants/leases for the property
      const leases = await this.rateLimiter.execute(() => 
        this.leasesService.fetch(propertyId, 1000, 0)
      );

      if (!leases?.length) {
        this.logger.warn(`No leases found for property ${propertyId}`);
        return [];
      }

      this.logger.log(`📋 Found ${leases.length} leases for property ${propertyId}`);

      // Step 2: Filter for renewal candidates
      const renewalCandidates = leases.filter(lease => this.isRenewalCandidate(lease));
      
      this.logger.log(`🎯 ${renewalCandidates.length} renewal candidates identified`);

      // Step 3: Fetch renewal data for each tenant in parallel (rate-limited)
      const renewalPromises = renewalCandidates.map(async (lease, index) => {
        try {
          // Add small stagger to spread requests
          await this.delay(index * 10);
          
          const renewalData = await this.fetchTenantRenewalData(lease, propertyId);
          console.log(`✅ Created renewal data for tenant ${lease.LeaseID} (${lease.OccupantName})`);
          return renewalData;
        } catch (error) {
          console.error(`❌ Failed to fetch renewal for tenant ${lease.LeaseID}: ${error.message}`);
          this.logger.error(`Failed to fetch renewal for tenant ${lease.LeaseID}: ${error.message}`);
          return null;
        }
      });

      // Wait for all parallel requests to complete
      const renewalResults = await Promise.allSettled(renewalPromises);
      
      console.log(`\n📊 Promise.allSettled results:`);
      renewalResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`  [${index}] FULFILLED - value is ${result.value ? 'valid' : 'null'}`);
        } else {
          console.log(`  [${index}] REJECTED - ${result.reason}`);
        }
      });
      
      // Process results
      const renewals = renewalResults
        .filter((result): result is PromiseFulfilledResult<RenewalData> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);
      
      console.log(`\n📦 Filtered renewals array length: ${renewals.length}`);

      const errors = renewalResults
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .length;

      const duration = Date.now() - startTime;
      const stats = this.rateLimiter.getStats();
      
      this.logger.log(
        `✅ Property ${propertyId} sync complete: ${renewals.length} renewals, ${errors} errors in ${duration}ms`
      );
      this.logger.log(`📊 Rate limiter stats: ${JSON.stringify(stats)}`);

      return renewals;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Failed to fetch renewals for property ${propertyId} after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  private async fetchTenantRenewalData(lease: any, propertyId: string): Promise<RenewalData> {
    console.log(`\n🔍 Fetching renewal data for tenant ${lease.LeaseID} (${lease.OccupantName})`);

    // Build the date range for TenantLedger: 12 months back → today
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const startDate = twelveMonthsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Fetch all data in parallel with rate limiting
    const [offers, emeaData, openCharges, tenantLedger, delinquencies] = await Promise.all([
      // 1. Renewal offers (may not be available for commercial)
      this.rateLimiter.execute(() =>
        this.renewalOffersService.fetch(propertyId)
          .then(offers => {
            const offer = offers.find(o => o.LeaseID === lease.LeaseID);
            console.log(`  📋 Renewal offer for ${lease.LeaseID}: ${offer ? 'found' : 'not found'}`);
            return offer;
          })
          .catch(error => {
            if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
              console.log(`  ⚠️  Renewal offers not available for property ${propertyId} (likely commercial)`);
              return undefined;
            }
            console.error(`  ❌ Renewal offers error: ${error.message}`);
            throw error;
          })
      ),

      // 2. EMEA / budget data
      this.rateLimiter.execute(() =>
        this.emeaService.fetch(propertyId)
          .then(emea => {
            const emeaRecord = emea.find(e => e.LeaseId === lease.LeaseID);
            console.log(`  📋 EMEA data for ${lease.LeaseID}: ${emeaRecord ? 'found' : 'not found'}`);
            return emeaRecord;
          })
          .catch(error => {
            console.log(`  ⚠️  EMEA data not available: ${error.message}`);
            return undefined;
          })
      ),

      // 3. OpenCharges (charges & balance)
      this.rateLimiter.execute(() =>
        this.openChargesService.fetch(propertyId, lease.LeaseID)
          .catch(error => {
            console.log(`  ⚠️  OpenCharges not available for ${lease.LeaseID}: ${error.message}`);
            return [];
          })
      ),

      // 4. TenantLedger (payments & transaction history - current + prior month)
      this.rateLimiter.execute(() =>
        this.tenantLedgerService.fetch(propertyId, lease.LeaseID, startDate, endDate)
          .catch(error => {
            console.log(`  ⚠️  TenantLedger not available for ${lease.LeaseID}: ${error.message}`);
            return [];
          })
      ),

      // 5. CurrentDelinquencies (aging buckets)
      this.rateLimiter.execute(() =>
        this.currentDelinquenciesService.fetch(propertyId, lease.LeaseID)
          .catch(error => {
            console.log(`  ⚠️  CurrentDelinquencies not available for ${lease.LeaseID}: ${error.message}`);
            return [];
          })
      ),
    ]);

    // Map the raw API data into the unified report fields
    const mriReportFields = this.fieldMappingService.map(
      openCharges,
      tenantLedger,
      delinquencies,
      lease.LeaseID,
    );

    console.log(`  📊 MRI report fields for ${lease.LeaseID}:`, JSON.stringify(mriReportFields));

    const renewalData = this.transformToRenewalData(lease, offers, emeaData, propertyId, mriReportFields);
    console.log(`  ✅ Transformed renewal data for ${lease.LeaseID}: tenantId=${renewalData.tenantId}, propertyId=${renewalData.propertyId}`);

    return renewalData;
  }

  async fetchIncrementalRenewals(propertyId: string, since: Date): Promise<RenewalData[]> {
    // For incremental sync, we could filter leases by modification date
    // For now, MRI doesn't support this well, so we fetch all and filter
    this.logger.log(`🔄 Incremental sync for property ${propertyId} since ${since.toISOString()}`);
    
    const allRenewals = await this.fetchRenewals(propertyId);
    
    // In a real implementation, you'd filter by lastModified date from MRI
    // For now, return all renewals (the repository will handle upserts)
    return allRenewals;
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Test with a simple rate-limited request
      await this.rateLimiter.execute(() => this.leasesService.fetch('1', 1, 0));
      return true;
    } catch (error) {
      this.logger.error(`MRI connection validation failed: ${error.message}`);
      return false;
    }
  }

  private isRenewalCandidate(lease: any): boolean {
    // Check for expiration date (MRI uses 'ExpirationDate' field)
    const expirationDate = lease.ExpirationDate || lease.LeaseExpirationDate;
    
    if (!expirationDate) {
      console.log(`❌ Lease ${lease.LeaseID} has no expiration date, skipping`);
      this.logger.debug(`Lease ${lease.LeaseID} has no expiration date, skipping`);
      return false;
    }
    
    const currentDate = new Date();
    const leaseEndDate = new Date(expirationDate);
    
    // If configured to include all active leases, just check if not expired
    if (this.includeAllActive) {
      const isActive = leaseEndDate >= currentDate;
      if (!isActive) {
        console.log(`❌ Lease ${lease.LeaseID} (${lease.OccupantName}) is expired, skipping`);
        this.logger.debug(`Lease ${lease.LeaseID} (${lease.OccupantName}) is expired, skipping`);
      } else {
        console.log(`✅ Lease ${lease.LeaseID} (${lease.OccupantName}) is ACTIVE - including`);
      }
      return isActive;
    }
    
    // Otherwise, use the configured window
    const monthsUntilExpiry = (leaseEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    // Include leases within the configured window
    const isCandidate = monthsUntilExpiry >= -this.renewalWindowMonthsAfter && 
                        monthsUntilExpiry <= this.renewalWindowMonthsBefore;
    
    if (!isCandidate) {
      console.log(`❌ Lease ${lease.LeaseID} (${lease.OccupantName}) expires in ${monthsUntilExpiry.toFixed(1)} months - outside window`);
      this.logger.debug(
        `Lease ${lease.LeaseID} (${lease.OccupantName}) expires in ${monthsUntilExpiry.toFixed(1)} months - outside renewal window (-${this.renewalWindowMonthsAfter} to +${this.renewalWindowMonthsBefore} months)`
      );
    } else {
      console.log(`✅ Lease ${lease.LeaseID} (${lease.OccupantName}) expires in ${monthsUntilExpiry.toFixed(1)} months - INCLUDED`);
    }
    
    return isCandidate;
  }

  private transformToRenewalData(
    lease: any,
    offer: any,
    emeaData: any,
    propertyId: string,
    mriReportFields: Partial<RenewalData> = {},
  ): RenewalData {
    const sf = lease.OrigSqFt || 0;
    const currentRent = lease.CurrentRent || 0;
    const rentPerSf = sf > 0 ? (currentRent * 12) / sf : 0;

    // MRI uses 'ExpirationDate' field
    const expirationDate = lease.ExpirationDate || lease.LeaseExpirationDate;

    return {
      tenantId: lease.MasterOccupantID || lease.LeaseID,
      propertyId,
      propertyName: lease.BuildingName || 'Unknown',
      tenantName: lease.OccupantName || 'Unknown Tenant',
      unit: lease.SuiteID || 'Unknown Unit',
      sf,
      leaseEnd: new Date(expirationDate),
      renewalOffer: offer?.RenewalAmount ? `$${offer.RenewalAmount}` : undefined,
      currentRent,
      rentPerSf: Number(rentPerSf.toFixed(2)),
      budgetRent: emeaData?.BudgetRent || undefined,
      budgetRentPerSf: emeaData?.BudgetRentPerSF || undefined,
      budgetTI: emeaData?.BudgetTI || undefined,
      budgetLCD: emeaData?.BudgetLCD || undefined,
      status: this.determineRenewalStatus(lease, offer, expirationDate),
      notes: lease.Notes || undefined,
      option: this.hasRenewalOption(lease, offer),
      optionTerm: offer?.LeaseTerm || undefined,
      lcd: lease.LeaseCommencementDate || undefined,
      mriLeaseId: lease.LeaseID,
      mriData: {
        lease,
        offer,
        emea: emeaData,
      },
      // Spread the mapped MRI report fields (monthlyRent, cam, ins, tax, etc.)
      ...mriReportFields,
    };
  }

  private determineRenewalStatus(lease: any, offer: any, expirationDate: string): string {
    if (offer?.Selected === 'Y') {
      return 'Renewed';
    }

    if (offer && offer.RenewalAmount > 0) {
      return 'Renewal Negotiation';
    }

    const leaseEndDate = new Date(expirationDate);
    const currentDate = new Date();

    if (leaseEndDate < currentDate) {
      return 'Expired';
    }

    const daysUntilExpiry = (leaseEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry <= 90) {
      return 'No Contact';
    }

    return 'Renewal Negotiation';
  }

  private hasRenewalOption(lease: any, offer: any): 'Yes' | 'No' | 'N/A' {
    if (offer && offer.LeaseTerm) {
      return 'Yes';
    }

    if (lease.HasOption === true || lease.OptionTerm) {
      return 'Yes';
    }

    return 'No';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}