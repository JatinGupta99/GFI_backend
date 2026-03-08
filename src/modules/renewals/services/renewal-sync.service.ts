import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RenewalSyncer, SyncResult } from '../interfaces/renewal-provider.interface';
import { RenewalRepository } from '../repositories/renewal.repository';
import { MriRenewalProvider } from '../providers/mri-renewal.provider';
import { PropertiesService } from '../../properties/properties.service';

export interface RenewalSyncJob {
  type: 'full' | 'incremental' | 'property';
  propertyIds?: string[];
  since?: Date;
  batchSize?: number;
  delayBetweenBatches?: number;
}

@Injectable()
export class RenewalSyncService implements RenewalSyncer {
  private readonly logger = new Logger(RenewalSyncService.name);

  constructor(
    @InjectQueue('renewal-sync')
    private readonly syncQueue: Queue<RenewalSyncJob>,
    private readonly renewalRepository: RenewalRepository,
    private readonly mriProvider: MriRenewalProvider,
    private readonly propertiesService: PropertiesService,
  ) {}

  async syncAllProperties(): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      const properties = await this.propertiesService.findAll();
      const propertyIds = properties.map(p => p.propertyId);

      // Queue background job for better performance
      const job = await this.syncQueue.add('full-sync', {
        type: 'full',
        propertyIds,
        batchSize: 5,
        delayBetweenBatches: 2000, // 2 seconds between batches
      });

      this.logger.log(`Queued full sync job ${job.id} for ${propertyIds.length} properties`);

      return {
        success: true,
        propertiesProcessed: 0, // Will be updated by job
        renewalsUpdated: 0,
        renewalsCreated: 0,
        errors: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to queue sync job: ${error.message}`);
      throw error;
    }
  }

  async syncProperty(propertyId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const syncTime = new Date();

    try {
      this.logger.log(`Starting sync for property ${propertyId}`);

      // Fetch renewals from MRI
      const renewalData = await this.mriProvider.fetchRenewals(propertyId);
      
      console.log(`\n📦 Renewal data fetched: ${renewalData.length} records`);
      if (renewalData.length > 0) {
        console.log(`  Sample record:`, JSON.stringify(renewalData[0], null, 2));
      }

      // Bulk upsert to database
      console.log(`\n💾 Calling bulkUpsert with ${renewalData.length} records...`);
      const { created, updated } = await this.renewalRepository.bulkUpsert(renewalData);
      console.log(`  ✅ BulkUpsert result: ${created} created, ${updated} updated`);

      // Clean up stale records
      const deleted = await this.renewalRepository.deleteStaleRenewals(propertyId, syncTime);

      const duration = Date.now() - startTime;
      
      this.logger.log(
        `Sync completed for property ${propertyId}: ${created} created, ${updated} updated, ${deleted} deleted in ${duration}ms`
      );

      return {
        success: true,
        propertiesProcessed: 1,
        renewalsUpdated: updated,
        renewalsCreated: created,
        errors: [],
        duration,
        timestamp: syncTime,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Sync failed for property ${propertyId}: ${error.message}`);

      return {
        success: false,
        propertiesProcessed: 0,
        renewalsUpdated: 0,
        renewalsCreated: 0,
        errors: [error.message],
        duration,
        timestamp: syncTime,
      };
    }
  }

  async syncIncremental(since?: Date): Promise<SyncResult> {
    const startTime = Date.now();
    const syncSince = since || await this.getLastSyncTime();

    if (!syncSince) {
      this.logger.warn('No previous sync time found, performing full sync');
      return this.syncAllProperties();
    }

    try {
      const properties = await this.propertiesService.findAll();
      const propertyIds = properties.map(p => p.propertyId);

      // Queue incremental sync job
      const job = await this.syncQueue.add('incremental-sync', {
        type: 'incremental',
        propertyIds,
        since: syncSince,
        batchSize: 5,
        delayBetweenBatches: 5000, // 5 second for incremental
      });

      this.logger.log(`Queued incremental sync job ${job.id} since ${syncSince.toISOString()}`);

      return {
        success: true,
        propertiesProcessed: 0,
        renewalsUpdated: 0,
        renewalsCreated: 0,
        errors: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to queue incremental sync: ${error.message}`);
      throw error;
    }
  }

  async syncPropertiesBatch(propertyIds: string[]): Promise<SyncResult> {
    const startTime = Date.now();
    const syncTime = new Date();
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    this.logger.log(`🚀 Starting optimized batch sync for ${propertyIds.length} properties`);

    // Process properties in parallel with controlled concurrency
    // Each property will internally handle tenant-level parallelization
    const PROPERTY_CONCURRENCY = 1; // Process 3 properties at once
    const results = await this.processWithConcurrency(
      propertyIds,
      async (propertyId) => {
        try {
          const result = await this.syncProperty(propertyId);
          return result;
        } catch (error) {
          errors.push(`Property ${propertyId}: ${error.message}`);
          return null;
        }
      },
      PROPERTY_CONCURRENCY
    );

    // Aggregate results
    results.forEach(result => {
      if (result) {
        totalCreated += result.renewalsCreated;
        totalUpdated += result.renewalsUpdated;
      }
    });

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r?.success).length;

    this.logger.log(
      `✅ Optimized batch sync completed: ${successCount}/${propertyIds.length} properties, ${totalCreated} created, ${totalUpdated} updated in ${(duration/1000).toFixed(1)}s`
    );

    return {
      success: errors.length === 0,
      propertiesProcessed: successCount,
      renewalsUpdated: totalUpdated,
      renewalsCreated: totalCreated,
      errors,
      duration,
      timestamp: syncTime,
    };
  }

  private async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    
    // Process in smaller batches to avoid overwhelming the system
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(item => processor(item))
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      // No delay needed here - the MRI provider handles rate limiting internally
      // Each property sync will use the rate limiter for tenant-level requests
    }

    return results;
  }

  private async getLastSyncTime(): Promise<Date | null> {
    return this.renewalRepository.getLastSyncTime();
  }

  async getJobStatus(jobId: string) {
    const job = await this.syncQueue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  async clearQueue(): Promise<{ cleared: number }> {
    const waiting = await this.syncQueue.getWaiting();
    const active = await this.syncQueue.getActive();
    
    await this.syncQueue.clean(0, 1000, 'completed');
    await this.syncQueue.clean(0, 1000, 'failed');
    
    for (const job of [...waiting, ...active]) {
      await job.remove();
    }

    const cleared = waiting.length + active.length;
    this.logger.log(`Cleared ${cleared} jobs from renewal sync queue`);
    
    return { cleared };
  }
}