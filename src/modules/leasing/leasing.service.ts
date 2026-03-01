import {
    Injectable,
    Logger,
    Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as cacheManager from 'cache-manager';
import pLimit from 'p-limit';

import { MriLeasesService } from '../rent-roll/mri/mri-leases.service';
import { MriRenewalOffersService } from '../rent-roll/mri/mri-renewal-offers.service';
import { MriLeaseEmeaService } from '../rent-roll/mri/mri-lease-emea.service';
import { MriNotesService } from '../rent-roll/mri/mri-notes.service';
import { MriCommercialLeaseNotesService } from '../rent-roll/mri/mri-commercial-lease-notes.service';
import { MriOptionsService } from '../rent-roll/mri/mri-options.service';
import { MriChargesService } from '../rent-roll/mri/mri-charges.service';

import { UpcomingRenewal } from './dto/upcoming-renewal.dto';
import { PropertiesService } from '../properties/properties.service';
import { Property } from '../properties/schema/property.entity';
import { RenewalsSyncJob, RenewalsSyncResult } from './renewals.processor';

@Injectable()
export class LeasingService {
    private readonly logger = new Logger(LeasingService.name);

    /**
     * Limits concurrent MRI calls across properties
     * Set to 1 to process completely sequentially
     */
    private readonly globalLimit = pLimit(1);

    /**
     * Limits per-lease MRI fan-out (notes/options/charges)
     * Reduced to 2 to avoid hitting rate limits
     */
    private readonly leaseLimit = pLimit(2);

    /**
     * Cache TTLs (seconds)
     * Increased to reduce API calls
     */
    private static readonly OFFERS_TTL = 600; // 10 min
    private static readonly EMEA_TTL = 600; // 10 min
    private static readonly LEASES_TTL = 300; // 5 min

    constructor(
        @Inject(CACHE_MANAGER)
        private readonly cache: cacheManager.Cache,

        @InjectQueue('renewals-sync')
        private readonly renewalsQueue: Queue<RenewalsSyncJob, RenewalsSyncResult>,

        private readonly leasesService: MriLeasesService,
        private readonly renewalOffersService: MriRenewalOffersService,
        private readonly emeaService: MriLeaseEmeaService,
        private readonly notesService: MriNotesService,
        private readonly commercialLeaseNotesService: MriCommercialLeaseNotesService,
        private readonly optionsService: MriOptionsService,
        private readonly chargesService: MriChargesService,
        private readonly propertiesService: PropertiesService,
    ) { }

    /* -------------------------------------------------------------------------- */
    /*                               PUBLIC API                                   */
    /* -------------------------------------------------------------------------- */

    /**
     * Clear all renewal-related cache entries
     */
    async clearRenewalsCache(): Promise<void> {
        this.logger.log('🗑️  Clearing renewals cache...');
        
        const properties: Property[] = await this.propertiesService.findAll();
        
        // Clear all-renewals cache
        await this.cache.del('all-renewals');
        
        // Clear property-specific caches
        for (const property of properties) {
            const propertyId = property.propertyId;
            
            // Clear leases cache (all pages)
            const keys = [
                `leases:${propertyId}:1:50`,
                `leases:${propertyId}:1:100`,
                `leases:${propertyId}:1:1000`,
                `offers:${propertyId}`,
                `emea:${propertyId}`,
            ];
            
            for (const key of keys) {
                await this.cache.del(key);
            }
        }
        
        this.logger.log(`✅ Cleared cache for ${properties.length} properties`);
    }

    async clearSyncQueue(): Promise<{ 
        waiting: number; 
        active: number; 
        delayed: number; 
        failed: number;
    }> {
        this.logger.log('🗑️  Clearing sync queue...');
        
        // Get counts before clearing
        const [waiting, active, delayed, failed] = await Promise.all([
            this.renewalsQueue.getWaitingCount(),
            this.renewalsQueue.getActiveCount(),
            this.renewalsQueue.getDelayedCount(),
            this.renewalsQueue.getFailedCount(),
        ]);

        // Clear all jobs
        await Promise.all([
            this.renewalsQueue.clean(0, 1000, 'wait'),      // Remove waiting jobs
            this.renewalsQueue.clean(0, 1000, 'active'),    // Remove active jobs
            this.renewalsQueue.clean(0, 1000, 'delayed'),   // Remove delayed jobs
            this.renewalsQueue.clean(0, 1000, 'completed'), // Remove completed jobs
            this.renewalsQueue.clean(0, 1000, 'failed'),    // Remove failed jobs
        ]);

        // Drain queue (remove all jobs)
        await this.renewalsQueue.drain();

        this.logger.log(`✅ Cleared sync queue - Removed: ${waiting} waiting, ${active} active, ${delayed} delayed, ${failed} failed`);

        return { waiting, active, delayed, failed };
    }

    /**
     * Queue a background job to sync all renewals
     * Returns job ID for tracking progress
     */
    async queueRenewalsSync(options?: {
        batchSize?: number;
        delayBetweenBatches?: number;
        clearCache?: boolean;
    }): Promise<{ jobId: string }> {
        const properties: Property[] = await this.propertiesService.findAll();
        
        if (!properties?.length) {
            throw new Error('No properties found');
        }

        // Clear cache before starting sync (default: true)
        if (options?.clearCache !== false) {
            await this.clearRenewalsCache();
        }

        const job = await this.renewalsQueue.add(
            'sync-all-renewals',
            {
                propertyIds: properties.map(p => p.propertyId),
                batchSize: options?.batchSize || 1, // Process 1 property at a time
                delayBetweenBatches: options?.delayBetweenBatches || 300000, // 5 minutes (300 seconds)
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: {
                    age: 3600, // Keep completed jobs for 1 hour
                    count: 100,
                },
                removeOnFail: {
                    age: 86400, // Keep failed jobs for 24 hours
                },
            },
        );

        this.logger.log(`Queued renewals sync job: ${job.id}`);

        return { jobId: job.id! };
    }

    /**
     * Get job status and progress
     */
    async getJobStatus(jobId: string) {
        const job = await this.renewalsQueue.getJob(jobId);

        if (!job) {
            return { status: 'not_found' };
        }

        const state = await job.getState();
        const progress = job.progress;

        return {
            id: job.id,
            status: state,
            progress,
            result: job.returnvalue,
            failedReason: job.failedReason,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
        };
    }

    /**
     * Get cached renewals (from last successful sync)
     */
    async getCachedRenewals(): Promise<UpcomingRenewal[]> {
        const cached = await this.cache.get<UpcomingRenewal[]>('all-renewals');
        return cached || [];
    }

    /**
     * Add a note to a commercial lease for upcoming renewal
     * @param buildingId - Building ID
     * @param leaseId - Lease ID
     * @param noteText - The note text
     * @param noteReference1 - Note reference type 1 (default: 'RENEWAL')
     * @param noteReference2 - Note reference type 2 (default: '*')
     */
    async addRenewalNote(
        buildingId: string,
        leaseId: string,
        noteText: string,
        noteReference1: string = 'RENEWAL',
        noteReference2: string = '*'
    ) {
        this.logger.log(`Adding renewal note for lease ${leaseId} in building ${buildingId}`);
        
        const note = await this.commercialLeaseNotesService.create({
            BuildingID: buildingId,
            LeaseID: leaseId,
            NoteDate: new Date().toISOString(),
            NoteText: noteText,
            NoteReference1: noteReference1,
            NoteReference2: noteReference2
        });

        this.logger.log(`✅ Renewal note added successfully for lease ${leaseId}`);
        return note;
    }

    /**
     * Get all notes for a commercial lease
     * @param buildingId - Building ID
     * @param leaseId - Lease ID
     */
    async getRenewalNotes(buildingId: string, leaseId: string) {
        this.logger.log(`Fetching renewal notes for lease ${leaseId} in building ${buildingId}`);
        return this.commercialLeaseNotesService.fetchByLease(buildingId, leaseId);
    }

    /**
     * Legacy method - now triggers background job
     * @deprecated Use queueRenewalsSync() instead
     */
    /**
     * @deprecated Use queueRenewalsSync() for background processing
     * Fetches renewals for all properties directly (synchronous, may be slow)
     */
    async getAllUpcomingRenewals(): Promise<UpcomingRenewal[]> {
        this.logger.warn('getAllUpcomingRenewals() is deprecated. Consider using queueRenewalsSync() for better performance.');
        
        // Fetch all properties
        const properties: Property[] = await this.propertiesService.findAll();
        
        if (!properties?.length) {
            this.logger.warn('No properties found');
            return [];
        }

        this.logger.log(`Fetching renewals for ${properties.length} properties directly from MRI...`);

        // Fetch renewals for each property (with default pagination)
        const allRenewals: UpcomingRenewal[] = [];
        
        for (const property of properties) {
            try {
                const renewals = await this.getUpcomingRenewals(property.propertyId, 1, 50);
                allRenewals.push(...renewals);
                this.logger.log(`✓ Fetched ${renewals.length} renewals for property ${property.propertyId}`);
            } catch (error) {
                this.logger.error(`✗ Failed to fetch renewals for property ${property.propertyId}: ${error.message}`);
            }
        }

        this.logger.log(`Total renewals fetched: ${allRenewals.length}`);
        return allRenewals;
    }

    async getUpcomingRenewals(
        propertyId: string,
        page = 1,
        limit = 50,
        minimal = false, // New flag to skip optional data
    ): Promise<UpcomingRenewal[]> {
        const skip = (page - 1) * limit;

        this.logger.debug(
            `Fetching leases | property=${propertyId} page=${page} limit=${limit} minimal=${minimal}`,
        );

        const leases = await this.getCached(
            `leases:${propertyId}:${page}:${limit}`,
            () => this.leasesService.fetch(propertyId, limit, skip),
            LeasingService.LEASES_TTL,
            [],
        );

        if (!leases.length) return [];

        // Always fetch offers and emea (needed for expiration dates)
        const [offers, emea] = await Promise.all([
            this.getCached(
                `offers:${propertyId}`,
                () => this.renewalOffersService.fetch(propertyId),
                LeasingService.OFFERS_TTL,
                [],
            ),
            this.getCached(
                `emea:${propertyId}`,
                () => this.emeaService.fetch(propertyId),
                LeasingService.EMEA_TTL,
                [],
            ),
        ]);

        const offersMap = new Map(offers.map(o => [o.LeaseID, o]));
        const emeaMap = new Map(emea.map(e => [e.LeaseId, e]));

        return Promise.all(
            leases.map(lease =>
                this.leaseLimit(() =>
                    this.mapLeaseToUpcomingRenewal(
                        propertyId,
                        lease,
                        offersMap,
                        emeaMap,
                        minimal, // Pass minimal flag
                    ),
                ),
            ),
        );
    }

    /* -------------------------------------------------------------------------- */
    /*                      HELPER METHODS FOR INCREMENTAL PROCESSOR              */
    /* -------------------------------------------------------------------------- */

    /**
     * Fetch all leases for a property (used by incremental processor)
     */
    async getPropertyLeases(propertyId: string): Promise<any[]> {
        this.logger.debug(`Fetching leases for property ${propertyId}`);
        return this.safeFetch(
            () => this.leasesService.fetch(propertyId, 1000, 0),
            [],
        );
    }

    /**
     * Fetch property metadata (offers and EMEA) (used by incremental processor)
     */
    async getPropertyMetadata(propertyId: string): Promise<[any[], any[]]> {
        this.logger.debug(`Fetching metadata for property ${propertyId}`);
        
        const [offers, emea] = await Promise.all([
            this.safeFetch(
                () => this.renewalOffersService.fetch(propertyId),
                [],
            ),
            this.safeFetch(
                () => this.emeaService.fetch(propertyId),
                [],
            ),
        ]);

        return [offers, emea];
    }

    /**
     * Process a single lease with its metadata (used by incremental processor)
     */
    async processLease(
        propertyId: string,
        lease: any,
        offersMap: Map<string, any>,
        emeaMap: Map<string, any>,
    ): Promise<UpcomingRenewal> {
        return this.mapLeaseToUpcomingRenewal(
            propertyId,
            lease,
            offersMap,
            emeaMap,
        );
    }

    /* -------------------------------------------------------------------------- */
    /*                             MAPPING LOGIC                                   */
    /* -------------------------------------------------------------------------- */

    private async mapLeaseToUpcomingRenewal(
            propertyId: string,
            lease: any,
            offersMap: Map<string, any>,
            emeaMap: Map<string, any>,
            minimal = false,
        ): Promise<UpcomingRenewal> {
            // Add small delay to avoid rate limiting (stagger requests)
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(lease,'csalsaclscanlasc')
            if (minimal) {
                console.log(minimal,'111111111111')
                return {
                    id: lease.LeaseID,
                    tenant: lease.OccupantName,
                    property: lease.BuildingName,
                    suite: lease.SuiteID,
                    sf: lease.OrigSqFt || 0,
                    expDate:
                        emeaMap.get(lease.LeaseID)?.Expiration ||
                        offersMap.get(lease.LeaseID)?.ExpirationDate ||
                        'N/A',
                    option: 'N/A', // Skip options API call
                    optionTerm: 'N/A',
                    rentPerSf: 0, // Skip charges API call
                    ti: 'N/A',
                    lcd: 'N/A',
                    budgetSf: lease.OrigSqFt || 0,
                    budgetRent: 0,
                    budgetLcd: 'N/A',
                    status: 'Renewal Negotiation',
                    note: '',
                };
            }
console.log(minimal,'2222222222')
            // Full mode: Fetch options, charges, and commercial lease notes
            const [options, charges, commercialNotes] = await Promise.all([
                this.safeFetch(
                    () => this.optionsService.fetch(propertyId, lease.LeaseID),
                    [],
                ),
                this.safeFetch(
                    () => this.chargesService.fetch(lease.LeaseID, propertyId),
                    [],
                ),
                this.safeFetch(
                    () => this.commercialLeaseNotesService.fetchByLease(propertyId, lease.LeaseID),
                    [],
                ),
            ]);

            // BRR = Base Rent from CurrentDelinquencies API
            const annualBaseRent =
                charges
                    .filter(c =>
                        ['BRR', 'RNT', 'RENT', 'BASE'].includes(
                            c.ChargeCode?.toUpperCase(),
                        ),
                    )
                    .reduce((sum, c) => sum + (c.Amount || 0), 0) * 12;

            const sf = options[0]?.SquareFeet || lease.OrigSqFt || 0;
            const rentPerSf = sf > 0 ? +(annualBaseRent / sf).toFixed(2) : 0;

            const optionTerm = options.length
                ? options
                    .map(
                        o =>
                            `Option ${o.OptionNumber ?? 'N/A'}: ${o.TermInMonths ?? 0
                            } months`,
                    )
                    .join(', ')
                : 'N/A';

            // Get the most recent note text
            const latestNote = commercialNotes.length > 0
                ? commercialNotes.sort((a, b) => 
                    new Date(b.LastUpdate).getTime() - new Date(a.LastUpdate).getTime()
                  )[0].NoteText
                : '';

            return {
                id: lease.LeaseID,
                tenant: lease.OccupantName,
                property: lease.BuildingName,
                suite: lease.SuiteID,
                sf,
                expDate:
                    emeaMap.get(lease.LeaseID)?.Expiration ||
                    offersMap.get(lease.LeaseID)?.ExpirationDate ||
                    'N/A',
                option: options.length ? 'Yes' : 'No',
                optionTerm,
                rentPerSf,
                ti: 'N/A',
                lcd: 'N/A',
                budgetSf: sf,
                budgetRent: 0,
                budgetLcd: 'N/A',
                status: 'Renewal Negotiation',
                note: latestNote,
            };
        }


    /* -------------------------------------------------------------------------- */
    /*                              CACHE UTILS                                    */
    /* -------------------------------------------------------------------------- */

    private async getCached<T>(
        key: string,
        fn: () => Promise<T>,
        ttlSeconds: number,
        fallback: T,
    ): Promise<T> {
        const cached = await this.cache.get<T>(key);
        if (cached) return cached;

        const value = await this.safeFetch(fn, fallback);
        await this.cache.set(key, value, ttlSeconds);
        return value;
    }

    private async safeFetch<T>(
        fn: () => Promise<T>,
        fallback: T,
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.logger.error(
                `Third-party API failed: ${error?.message}`,
                error?.stack,
            );
            return fallback;
        }
    }
}