import { InjectQueue } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import * as cacheManager from 'cache-manager';
import pLimit from 'p-limit';

import { MriChargesService } from '../rent-roll/mri/mri-charges.service';
import { MriCommercialLeaseNotesService } from '../rent-roll/mri/mri-commercial-lease-notes.service';
import { MriCommercialLeasesCmreccService } from '../rent-roll/mri/mri-commercial-leases-cmrecc.service';
import { MriCurrentDelinquenciesService } from '../rent-roll/mri/mri-current-delinquencies.service';
import { MriLeaseEmeaService } from '../rent-roll/mri/mri-lease-emea.service';
import { MriLeasesService } from '../rent-roll/mri/mri-leases.service';
import { MriNotesService } from '../rent-roll/mri/mri-notes.service';
import { MriOptionsService } from '../rent-roll/mri/mri-options.service';
import { MriRenewalOffersService } from '../rent-roll/mri/mri-renewal-offers.service';

import { PropertiesService } from '../properties/properties.service';
import { Property } from '../properties/schema/property.entity';
import { UpcomingRenewal } from './dto/upcoming-renewal.dto';
import { RenewalsSyncJob, RenewalsSyncResult } from './renewals.processor';
import { RenewalRepository } from './repository/renewal.repository';

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
        private readonly currentDelinquenciesService: MriCurrentDelinquenciesService,
        private readonly commercialLeasesCmreccService: MriCommercialLeasesCmreccService,
        private readonly propertiesService: PropertiesService,
        private readonly renewalRepository: RenewalRepository,
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
        
        // Clear stream cache
        await this.cache.del('renewals-stream-all');
        
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
        
        this.logger.log(`✅ Cleared cache for ${properties.length} properties + stream cache`);
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
     * Queue individual jobs for each property to sync renewals
     * Returns batch ID for tracking all related jobs
     * 
     * MRI Rate Limit: 2500 requests per 5 minutes
     * Strategy: Spread properties over 5 minutes with exponential backoff on 429 errors
     */
    /**
         * Queue individual jobs for each property to sync renewals
         * Returns batch ID for tracking all related jobs
         * 
         * Rate Limiting Strategy:
         * - Each property processes leases in batches (5 leases per batch, 2s delay between batches)
         * - This handles rate limiting even for properties with 300+ leases
         * - Job stagger is minimal since batch processing controls the rate
         */
        async queueRenewalsSync(options?: {
            propertyIds?: string[]; // Optional: sync specific properties
            delayBetweenJobs?: number; // Delay in ms between queuing jobs
            clearCache?: boolean;
        }): Promise<{ batchId: string; jobIds: string[]; totalProperties: number }> {
            // Get properties to sync
            let properties: Property[];

            if (options?.propertyIds?.length) {
                // Sync specific properties
                const propertyPromises = await Promise.all(
                    options.propertyIds.map(id => this.propertiesService.findOne(id))
                );
                properties = propertyPromises.filter((p): p is Property => p !== null);
            } else {
                // Sync all properties
                properties = await this.propertiesService.findAll();
            }

            if (!properties?.length) {
                throw new Error('No properties found');
            }

            // Clear cache before starting sync (default: true)
            if (options?.clearCache !== false) {
                await this.clearRenewalsCache();
            }

            // Generate batch ID to group related jobs
            const batchId = `batch-${Date.now()}`;
            const totalProperties = properties.length;
            const jobIds: string[] = [];

            // Minimal delay between jobs since batch processing handles rate limiting
            // 5 seconds allows one property to start processing before the next queues
            const delayBetweenJobs = options?.delayBetweenJobs || 5000;

            this.logger.log(
                `🚀 Queuing ${totalProperties} property sync jobs (Batch: ${batchId}, Delay: ${delayBetweenJobs}ms between jobs)`,
            );

            // Queue individual job for each property
            for (let i = 0; i < properties.length; i++) {
                const property = properties[i];

                const job = await this.renewalsQueue.add(
                    'renewals-sync',
                    {
                        propertyId: property.propertyId,
                        batchId,
                        propertyIndex: i + 1,
                        totalProperties,
                    },
                    {
                        attempts: 5, // 5 attempts for better retry on 429
                        backoff: {
                            type: 'exponential',
                            delay: 10000, // 10 seconds initial delay
                        },
                        removeOnComplete: {
                            age: 3600, // Keep completed jobs for 1 hour
                            count: 100,
                        },
                        removeOnFail: {
                            age: 86400, // Keep failed jobs for 24 hours
                        },
                        // Stagger jobs with minimal delay (batch processing handles rate limiting)
                        delay: i * delayBetweenJobs,
                    },
                );

                jobIds.push(job.id!);

                this.logger.log(
                    `  ✓ Queued job ${job.id} for property ${property.propertyId} (${i + 1}/${totalProperties}) - starts in ${(i * delayBetweenJobs / 1000).toFixed(1)}s`,
                );
            }

            this.logger.log(
                `✅ Queued ${jobIds.length} jobs with batch ID: ${batchId}`,
            );

            return {
                batchId,
                jobIds,
                totalProperties,
            };
        }


    /**
     * Get status of all jobs in a batch
     */
    async getBatchStatus(batchId: string): Promise<{
        batchId: string;
        totalJobs: number;
        completed: number;
        active: number;
        waiting: number;
        failed: number;
        jobs: any[];
    }> {
        // Get all jobs from the queue
        const [completedJobs, activeJobs, waitingJobs, failedJobs] = await Promise.all([
            this.renewalsQueue.getCompleted(0, 1000),
            this.renewalsQueue.getActive(0, 1000),
            this.renewalsQueue.getWaiting(0, 1000),
            this.renewalsQueue.getFailed(0, 1000),
        ]);

        // Filter jobs by batchId
        const allJobs = [...completedJobs, ...activeJobs, ...waitingJobs, ...failedJobs];
        const batchJobs = allJobs.filter(job => job.data.batchId === batchId);

        // Count by status
        const completed = batchJobs.filter(j => j.finishedOn && !j.failedReason).length;
        const active = batchJobs.filter(j => j.processedOn && !j.finishedOn).length;
        const waiting = batchJobs.filter(j => !j.processedOn).length;
        const failed = batchJobs.filter(j => j.failedReason).length;

        // Get job details
        const jobs = await Promise.all(
            batchJobs.map(async (job) => {
                const state = await job.getState();
                return {
                    id: job.id,
                    propertyId: job.data.propertyId,
                    propertyIndex: job.data.propertyIndex,
                    totalProperties: job.data.totalProperties,
                    status: state,
                    progress: job.progress,
                    result: job.returnvalue,
                    failedReason: job.failedReason,
                    processedOn: job.processedOn,
                    finishedOn: job.finishedOn,
                };
            })
        );

        return {
            batchId,
            totalJobs: batchJobs.length,
            completed,
            active,
            waiting,
            failed,
            jobs,
        };
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
    /**
     * Sync renewals data to database
     * This method is called by the processor after fetching from MRI
     */
    async syncRenewalsToDatabase(renewals: UpcomingRenewal[], syncJobId: string): Promise<{
        created: number;
        updated: number;
        deactivated: number;
    }> {
        return this.renewalRepository.syncRenewals(renewals, syncJobId);
    }

    async getCachedRenewals(): Promise<UpcomingRenewal[]> {
        // First try to get from database (most recent sync)
        try {
            const dbRenewals = await this.renewalRepository.getAllActiveRenewals();
            if (dbRenewals.length > 0) {
                this.logger.debug(`Retrieved ${dbRenewals.length} renewals from database`);
                return dbRenewals;
            }
        } catch (error) {
            this.logger.warn(`Database query failed, falling back to cache: ${error.message}`);
        }

        // Fall back to cache
        const cached = await this.cache.get<UpcomingRenewal[]>('all-renewals');
        return cached || [];
    }

    /**
     * Add a note to a commercial lease for upcoming renewal
     * Since MRI API only supports GET (reading), this stores the note locally
     * and fetches existing MRI notes for context
     * 
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
        
        // First, fetch existing notes from MRI to provide context
        try {
            const existingNotes = await this.commercialLeaseNotesService.fetchByLease(buildingId, leaseId);
            this.logger.log(`Found ${existingNotes.length} existing notes in MRI for lease ${leaseId}`);
        } catch (error) {
            this.logger.warn(`Could not fetch existing MRI notes: ${error.message}`);
        }
        
        // Create the renewal note (stored locally since MRI API is read-only)
        const note = await this.commercialLeaseNotesService.create({
            BuildingID: buildingId,
            LeaseID: leaseId,
            NoteDate: new Date().toISOString(),
            NoteText: noteText,
            NoteReference1: noteReference1,
            NoteReference2: noteReference2
        });

        this.logger.log(`✅ Renewal note added successfully for lease ${leaseId} (stored locally)`);
        return note;
    }

    /**
     * Get all notes for a commercial lease (combines MRI and local notes)
     * @param buildingId - Building ID
     * @param leaseId - Lease ID
     */
    async getRenewalNotes(buildingId: string, leaseId: string) {
        this.logger.log(`Fetching renewal notes for lease ${leaseId} in building ${buildingId}`);
        
        try {
            // Fetch notes from MRI API (read-only)
            const mriNotes = await this.commercialLeaseNotesService.fetchByLease(buildingId, leaseId);
            this.logger.log(`Retrieved ${mriNotes.length} notes from MRI for lease ${leaseId}`);
            return mriNotes;
        } catch (error) {
            this.logger.error(`Failed to fetch MRI notes: ${error.message}`);
            return [];
        }
    }

    /**
     * Stream renewals in batches with progressive responses
     * Processes properties in batches and yields results as they complete
     * Supports caching to avoid repeated MRI API calls
     */
    async *streamRenewalsInBatches(
        batchSize: number = 2,
        delayMs: number = 300000, // 5 minutes
        useCache: boolean = true
    ): AsyncGenerator<{
        type: 'batch' | 'complete' | 'error' | 'cache';
        batchNumber?: number;
        totalBatches?: number;
        propertiesProcessed?: string[];
        renewalsCount?: number;
        data?: UpcomingRenewal[];
        totalRenewals?: number;
        error?: string;
        fromCache?: boolean;
        cacheAge?: number;
        progress?: {
            current: number;
            total: number;
            percentage: number;
        };
    }> {
        try {
            const cacheKey = 'renewals-stream-all';
            const cacheTTL = 1800; // 30 minutes

            // Check cache first if enabled
            if (useCache) {
                const cached = await this.cache.get<{
                    data: UpcomingRenewal[];
                    timestamp: number;
                }>(cacheKey);

                if (cached && cached.data) {
                    const cacheAge = Math.floor((Date.now() - cached.timestamp) / 1000);
                    this.logger.log(`📦 Serving from cache (age: ${cacheAge}s)`);

                    // Stream cached data in batches for consistent UX
                    const totalRenewals = cached.data.length;
                    const totalBatches = Math.ceil(totalRenewals / 50); // 50 renewals per batch

                    for (let i = 0; i < totalRenewals; i += 50) {
                        const batchNumber = Math.floor(i / 50) + 1;
                        const batchData = cached.data.slice(i, i + 50);

                        yield {
                            type: 'batch',
                            batchNumber,
                            totalBatches,
                            renewalsCount: batchData.length,
                            data: batchData,
                            fromCache: true,
                            cacheAge,
                            progress: {
                                current: Math.min(i + 50, totalRenewals),
                                total: totalRenewals,
                                percentage: Math.round((Math.min(i + 50, totalRenewals) / totalRenewals) * 100)
                            }
                        };

                        // Small delay for UX (optional)
                        if (i + 50 < totalRenewals) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }

                    yield {
                        type: 'complete',
                        totalRenewals,
                        data: cached.data,
                        fromCache: true,
                        cacheAge
                    };

                    return;
                }
            }

            // No cache or cache disabled - fetch from MRI
            this.logger.log(`🔄 Fetching from MRI (cache ${useCache ? 'miss' : 'disabled'})`);

            const properties = await this.propertiesService.findAll();
            
            if (!properties?.length) {
                yield { type: 'error', error: 'No properties found' };
                return;
            }

            const totalProperties = properties.length;
            const totalBatches = Math.ceil(totalProperties / batchSize);
            let allRenewals: UpcomingRenewal[] = [];
            let processedCount = 0;

            this.logger.log(`Starting batched renewals: ${totalProperties} properties in ${totalBatches} batches`);

            for (let i = 0; i < totalProperties; i += batchSize) {
                const batchNumber = Math.floor(i / batchSize) + 1;
                const batch = properties.slice(i, i + batchSize);
                const batchPropertyIds = batch.map(p => p.propertyId);

                this.logger.log(`Batch ${batchNumber}/${totalBatches}: ${batchPropertyIds.join(', ')}`);

                const batchRenewals: UpcomingRenewal[] = [];
                
                await Promise.all(
                    batch.map(async (property) => {
                        try {
                            const renewals = await this.getUpcomingRenewals(property.propertyId, 1, 50);
                            batchRenewals.push(...renewals);
                            this.logger.log(`✓ ${renewals.length} renewals for ${property.propertyId}`);
                        } catch (error) {
                            this.logger.error(`✗ Failed ${property.propertyId}: ${error.message}`);
                        }
                    })
                );

                allRenewals.push(...batchRenewals);
                processedCount += batch.length;

                yield {
                    type: 'batch',
                    batchNumber,
                    totalBatches,
                    propertiesProcessed: batchPropertyIds,
                    renewalsCount: batchRenewals.length,
                    data: batchRenewals,
                    fromCache: false,
                    progress: {
                        current: processedCount,
                        total: totalProperties,
                        percentage: Math.round((processedCount / totalProperties) * 100)
                    }
                };

                if (i + batchSize < totalProperties) {
                    this.logger.log(`Waiting ${delayMs / 1000}s before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }

            // Cache the results if caching is enabled
            if (useCache && allRenewals.length > 0) {
                await this.cache.set(
                    cacheKey,
                    {
                        data: allRenewals,
                        timestamp: Date.now()
                    },
                    cacheTTL
                );
                this.logger.log(`💾 Cached ${allRenewals.length} renewals (TTL: ${cacheTTL}s)`);
            }

            yield {
                type: 'complete',
                totalRenewals: allRenewals.length,
                data: allRenewals,
                fromCache: false
            };

            this.logger.log(`✅ Completed: ${allRenewals.length} total renewals`);

        } catch (error) {
            this.logger.error(`Error in streamRenewalsInBatches: ${error.message}`);
            yield { type: 'error', error: error.message };
        }
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
        minimal = false,
    ): Promise<UpcomingRenewal[]> {
        const dbRenewals = await this.renewalRepository.getRenewalsByProperty(propertyId, page, limit);
        
        if (dbRenewals.length > 0) {
            this.logger.debug(`Retrieved ${dbRenewals.length} renewals from database for property ${propertyId}`);
            return dbRenewals;
        }
        
        this.logger.debug(`No renewals found in database for property ${propertyId}`);
        return [];
    }

    /**
     * Fetch renewals from MRI API and save to database in batches
     * Used by sync jobs to get latest data from MRI
     * 
     * Batch Processing Strategy:
     * - Process 5 leases per batch
     * - Save each batch to database immediately
     * - Add 2-second delay between batches
     * - If rate limit hit, already processed batches are saved
     * 
     * Rate Calculation:
     * - Each lease: 5 API calls (options, charges, notes, delinquencies, cmrecc)
     * - Each batch: 5 leases × 5 calls = 25 API calls
     * - Batch time: ~3 seconds (API latency + delay)
     * - Rate: 25 calls / 3 sec ≈ 8.3 calls/sec (within MRI limit)
     */
    async fetchAndSyncRenewalsFromMRI(propertyId: string, syncJobId: string): Promise<{
        totalLeases: number;
        processedLeases: number;
        savedRenewals: number;
        failedLeases: number;
    }> {
        this.logger.log(`🔄 Fetching and syncing renewals from MRI for property ${propertyId}`);
        
        let totalLeases = 0;
        let processedLeases = 0;
        let savedRenewals = 0;
        let failedLeases = 0;

        try {
            // Fetch property details to get property name and MRI building ID
            const property = await this.propertiesService.findOne(propertyId);
            const propertyName = property?.propertyName || propertyId;

            // Resolve the 6-digit MRI building ID (buildingId takes priority over propertyId)
            const mriId: string = (property as any)?.buildingId || propertyId;
            const isSixDigit = /^\d{6}$/.test(mriId);
            if (!isSixDigit) {
                this.logger.warn(
                    `⚠️  Property ${propertyId} has no valid 6-digit buildingId (got "${mriId}"). Skipping MRI sync.`,
                );
                return { totalLeases: 0, processedLeases: 0, savedRenewals: 0, failedLeases: 0 };
            }

            this.logger.log(`📍 Property: ${propertyName} (internal: ${propertyId}, MRI buildingId: ${mriId})`);

            // Fetch all leases for the property using the MRI building ID
            const leases = await this.safeFetch(
                () => this.leasesService.fetch(mriId, 1000, 0),
                [],
            );

            if (!leases?.length) {
                this.logger.warn(`No leases found in MRI for property ${propertyId}`);
                return { totalLeases: 0, processedLeases: 0, savedRenewals: 0, failedLeases: 0 };
            }

            totalLeases = leases.length;
            this.logger.log(`📋 Found ${totalLeases} leases in MRI for property ${propertyId}`);

            // ── Upcoming-only filter ──────────────────────────────────────────
            // Keep only leases expiring between today and 24 months from now.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const cutoff = new Date(today);
            cutoff.setMonth(cutoff.getMonth() + 24);

            const upcomingLeases = leases.filter(lease => {
                const raw = lease.LeaseExpirationDate;
                if (!raw || raw === 'N/A') return false;
                const exp = new Date(raw);
                return !isNaN(exp.getTime()) && exp >= today && exp <= cutoff;
            });

            this.logger.log(
                `📅 Upcoming filter (today → +24 months): ${upcomingLeases.length}/${totalLeases} leases qualify`,
            );

            if (!upcomingLeases.length) {
                this.logger.warn(`No upcoming renewals (within 24 months) for property ${propertyId}`);
                return { totalLeases, processedLeases: 0, savedRenewals: 0, failedLeases: 0 };
            }
            // ─────────────────────────────────────────────────────────────────

            // Fetch property metadata (offers and EMEA) using MRI building ID
            const [offers, emea] = await this.getPropertyMetadata(mriId);

            // Create lookup maps
            const offersMap = new Map(offers.map(o => [o.LeaseID, o]));
            const emeaMap = new Map(emea.map(e => [e.LeaseId, e]));

            this.logger.log(`📊 Metadata: ${offers.length} offers, ${emea.length} EMEA records`);

            // Process leases in batches to respect rate limits
            const BATCH_SIZE = 5; // 5 leases per batch
            const BATCH_DELAY = 2000; // 2 seconds between batches
            const totalBatches = Math.ceil(upcomingLeases.length / BATCH_SIZE);

            this.logger.log(`🔄 Processing ${upcomingLeases.length} upcoming leases in ${totalBatches} batches (${BATCH_SIZE} leases per batch)`);

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const start = batchIndex * BATCH_SIZE;
                const end = Math.min(start + BATCH_SIZE, upcomingLeases.length);
                const batch = upcomingLeases.slice(start, end);

                this.logger.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (leases ${start + 1}-${end})`);

                // Process all leases in current batch using MRI building ID for sub-calls
                const batchRenewals: UpcomingRenewal[] = [];
                for (const lease of batch) {
                    try {
                        const renewal = await this.processLease(
                            mriId,
                            lease,
                            offersMap,
                            emeaMap,
                        );
                        batchRenewals.push(renewal);
                        processedLeases++;
                    } catch (error) {
                        this.logger.error(`Failed to process lease ${lease.LeaseID}: ${error.message}`);
                        failedLeases++;
                    }
                }

                // Save batch to database immediately with property name
                if (batchRenewals.length > 0) {
                    try {
                        this.logger.log(`💾 Saving batch ${batchIndex + 1} (${batchRenewals.length} renewals) to database...`);
                        const saveResult = await this.renewalRepository.syncRenewals(batchRenewals, syncJobId, propertyName);
                        savedRenewals += (saveResult.created + saveResult.updated);
                        this.logger.log(`✅ Batch ${batchIndex + 1} saved: ${saveResult.created} created, ${saveResult.updated} updated`);
                    } catch (error) {
                        this.logger.error(`❌ Failed to save batch ${batchIndex + 1} to database: ${error.message}`);
                    }
                }

                // Add delay between batches (except after last batch)
                if (batchIndex < totalBatches - 1) {
                    this.logger.debug(`⏳ Waiting ${BATCH_DELAY}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                }
            }

            this.logger.log(`✅ Completed: ${processedLeases}/${totalLeases} leases processed, ${savedRenewals} renewals saved, ${failedLeases} failed`);
            
            return {
                totalLeases,
                processedLeases,
                savedRenewals,
                failedLeases,
            };
        } catch (error) {
            this.logger.error(`❌ Failed to fetch renewals from MRI for property ${propertyId}: ${error.message}`);
            
            return {
                totalLeases,
                processedLeases,
                savedRenewals,
                failedLeases,
            };
        }
    }

    /**
     * Legacy method - kept for backward compatibility
     * Use fetchAndSyncRenewalsFromMRI for new implementations
     */
    async fetchRenewalsFromMRI(propertyId: string): Promise<UpcomingRenewal[]> {
        this.logger.log(`🔄 Fetching renewals from MRI for property ${propertyId}`);
        
        try {
            // Fetch all leases for the property
            const leases = await this.safeFetch(
                () => this.leasesService.fetch(propertyId, 1000, 0),
                [],
            );

            if (!leases?.length) {
                this.logger.warn(`No leases found in MRI for property ${propertyId}`);
                return [];
            }

            this.logger.log(`📋 Found ${leases.length} leases in MRI for property ${propertyId}`);

            // Fetch property metadata (offers and EMEA)
            const [offers, emea] = await this.getPropertyMetadata(propertyId);

            // Create lookup maps
            const offersMap = new Map(offers.map(o => [o.LeaseID, o]));
            const emeaMap = new Map(emea.map(e => [e.LeaseId, e]));

            this.logger.log(`📊 Metadata: ${offers.length} offers, ${emea.length} EMEA records`);

            // Process leases in batches to respect rate limits
            const BATCH_SIZE = 5; // 5 leases per batch
            const BATCH_DELAY = 2000; // 2 seconds between batches
            const renewals: UpcomingRenewal[] = [];
            const totalBatches = Math.ceil(leases.length / BATCH_SIZE);

            this.logger.log(`🔄 Processing ${leases.length} leases in ${totalBatches} batches (${BATCH_SIZE} leases per batch)`);

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const start = batchIndex * BATCH_SIZE;
                const end = Math.min(start + BATCH_SIZE, leases.length);
                const batch = leases.slice(start, end);

                this.logger.debug(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (leases ${start + 1}-${end})`);

                // Process all leases in current batch
                for (const lease of batch) {
                    try {
                        const renewal = await this.processLease(
                            propertyId,
                            lease,
                            offersMap,
                            emeaMap,
                        );
                        renewals.push(renewal);
                    } catch (error) {
                        this.logger.error(`Failed to process lease ${lease.LeaseID}: ${error.message}`);
                    }
                }

                // Add delay between batches (except after last batch)
                if (batchIndex < totalBatches - 1) {
                    this.logger.debug(`⏳ Waiting ${BATCH_DELAY}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                }
            }

            this.logger.log(`✅ Fetched ${renewals.length} renewals from MRI for property ${propertyId}`);
            return renewals;
        } catch (error) {
            this.logger.error(`❌ Failed to fetch renewals from MRI for property ${propertyId}: ${error.message}`);
            throw error;
        }
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
            // No artificial delay needed - batch processing handles rate limiting
            
            if (minimal) {
                
                // Even in minimal mode, fetch notes, current delinquencies, and rent charges since they're required for renewal schema
                const [commercialNotes, currentDelinquencies, rentCharges] = await Promise.all([
                    this.safeFetch(
                        () => this.commercialLeaseNotesService.fetchByLease(propertyId, lease.LeaseID),
                        [],
                    ),
                    this.safeFetch(
                        () => this.currentDelinquenciesService.fetch(propertyId, lease.LeaseID),
                        [],
                    ),
                    this.safeFetch(
                        () => this.commercialLeasesCmreccService.fetchAndProcessRentCharges(propertyId, lease.LeaseID),
                        { baseRent: 0, cam: 0, ins: 0, tax: 0, monthlyRent: 0, totalDueMonthly: 0 },
                    ),
                ]);
                
                const allNotes = commercialNotes.length > 0
                    ? commercialNotes
                        .sort((a, b) => new Date(b.LastUpdate).getTime() - new Date(a.LastUpdate).getTime())
                        .map(note => note.NoteText)
                        .join(' | ')
                    : '';

                // Process CurrentDelinquencies data for financial fields (minimal mode)
                let balanceDue = 0;
                let days0To30 = 0;
                let days31To60 = 0;
                let days61Plus = 0;

                if (currentDelinquencies.length > 0) {
                    balanceDue = Number(currentDelinquencies[0].TotalDelinquency) || 0;
                    for (const delinquency of currentDelinquencies) {
                        const amount = Number(delinquency.DelinquentAmount) || 0;
                        if (delinquency.NinetyPlusDayDelinquency === 'Y') {
                            days61Plus += amount;
                        } else if (delinquency.NinetyDayDelinquency === 'Y') {
                            days61Plus += amount;
                        } else if (delinquency.SixtyDayDelinquency === 'Y') {
                            days31To60 += amount;
                        } else if (delinquency.ThirtyDayDelinquency === 'Y') {
                            days0To30 += amount;
                        }
                    }
                }
                
                this.logger.debug(`Minimal mode: Fetched ${commercialNotes.length} notes, ${currentDelinquencies.length} delinquency records, and rent charges for lease ${lease.LeaseID}`);
                
                return {
                    id: lease.LeaseID,
                    tenant: lease.OccupantName,
                    property: propertyId, // Use propertyId parameter instead of BuildingName
                    suite: lease.SuiteID,
                    sf: (lease.OrigSqFt || 0).toString(),
                    expDate:
                        emeaMap.get(lease.LeaseID)?.Expiration ||
                        offersMap.get(lease.LeaseID)?.ExpirationDate ||
                        'N/A',
                    option: 'N/A', // Skip options API call
                    optionTerm: 'N/A',
                    rentPerSf: 0, // Skip charges API call
                    tiPerSf: 'N/A',
                    budgetSf: (lease.OrigSqFt || 0).toString(),
                    budgetRent: 0,
                    status: 'Renewal Negotiation',
                    note: allNotes,
                    // Financial fields from CurrentDelinquencies API (minimal mode)
                    balanceDue,
                    days0To30: days0To30.toFixed(2),
                    days31To60: days31To60.toFixed(2),
                    days61Plus: days61Plus.toFixed(2),
                    // Rent charge fields from CMRECC API (minimal mode)
                    monthlyRent: rentCharges.monthlyRent,
                    cam: rentCharges.cam,
                    ins: rentCharges.ins,
                    tax: rentCharges.tax,
                    totalDueMonthly: rentCharges.totalDueMonthly,
                };
            }
            
            // Full mode: Fetch options, charges, commercial lease notes, current delinquencies, and rent charges
            const [options, charges, commercialNotes, currentDelinquencies, rentCharges] = await Promise.all([
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
                this.safeFetch(
                    () => this.currentDelinquenciesService.fetch(propertyId, lease.LeaseID),
                    [],
                ),
                this.safeFetch(
                    () => this.commercialLeasesCmreccService.fetchAndProcessRentCharges(propertyId, lease.LeaseID),
                    { baseRent: 0, cam: 0, ins: 0, tax: 0, monthlyRent: 0, totalDueMonthly: 0 },
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

            // Get all notes and format them for the renewal
            const allNotes = commercialNotes.length > 0
                ? commercialNotes
                    .sort((a, b) => new Date(b.LastUpdate).getTime() - new Date(a.LastUpdate).getTime())
                    .map(note => note.NoteText)
                    .join(' | ')
                : '';

            this.logger.debug(`Fetched ${commercialNotes.length} notes for lease ${lease.LeaseID}, formatted: ${allNotes.substring(0, 100)}...`);

            // Process CurrentDelinquencies data for financial fields
            let balanceDue = 0;
            let days0To30 = 0;
            let days31To60 = 0;
            let days61Plus = 0;

            if (currentDelinquencies.length > 0) {
                // Get TotalDelinquency from first record (should be same across all records for the lease)
                balanceDue = Number(currentDelinquencies[0].TotalDelinquency) || 0;

                // Calculate aging buckets based on delinquency flags
                for (const delinquency of currentDelinquencies) {
                    const amount = Number(delinquency.DelinquentAmount) || 0;
                    
                    if (delinquency.NinetyPlusDayDelinquency === 'Y') {
                        days61Plus += amount;
                    } else if (delinquency.NinetyDayDelinquency === 'Y') {
                        days61Plus += amount;
                    } else if (delinquency.SixtyDayDelinquency === 'Y') {
                        days31To60 += amount;
                    } else if (delinquency.ThirtyDayDelinquency === 'Y') {
                        days0To30 += amount;
                    }
                }

                this.logger.debug(`Processed ${currentDelinquencies.length} delinquency records for lease ${lease.LeaseID}: balanceDue=${balanceDue}, 0-30=${days0To30}, 31-60=${days31To60}, 61+=${days61Plus}`);
            }

            return {
                id: lease.LeaseID,
                tenant: lease.OccupantName,
                property: propertyId, // Use propertyId parameter instead of BuildingName
                suite: lease.SuiteID,
                sf: sf.toString(),
                expDate:
                    emeaMap.get(lease.LeaseID)?.Expiration ||
                    offersMap.get(lease.LeaseID)?.ExpirationDate ||
                    'N/A',
                option: options.length ? 'Yes' : 'No',
                optionTerm,
                rentPerSf,
                tiPerSf: 'N/A',
                budgetSf: sf.toString(),
                budgetRent: 0,
                status: 'Renewal Negotiation',
                note: allNotes,
                // Financial fields from CurrentDelinquencies API
                balanceDue,
                days0To30: days0To30.toFixed(2),
                days31To60: days31To60.toFixed(2),
                days61Plus: days61Plus.toFixed(2),
                // Rent charge fields from CMRECC API
                monthlyRent: rentCharges.monthlyRent,
                cam: rentCharges.cam,
                ins: rentCharges.ins,
                tax: rentCharges.tax,
                totalDueMonthly: rentCharges.totalDueMonthly,
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