import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Renewal, RenewalDocument } from '../renewal.entity';
import { MriDataAggregatorService } from './mri-data-aggregator.service';
import { RenewalSyncer, SyncResult } from '../interfaces/renewal-provider.interface';

export interface RenewalSyncJob {
  type: string;
  propertyIds: string[];
  since?: Date;
  batchSize?: number;
  delayBetweenBatches?: number;
}

interface BatchSyncResult {
  renewalsCreated: number;
  renewalsUpdated: number;
  propertiesProcessed: number;
  errors: string[];
}

interface BatchSyncResult {
  renewalsCreated: number;
  renewalsUpdated: number;
  propertiesProcessed: number;
  errors: string[];
}

@Injectable()
export class RenewalSyncService implements RenewalSyncer {
  private readonly logger = new Logger(RenewalSyncService.name);

  constructor(
    @InjectModel(Renewal.name) private renewalModel: Model<RenewalDocument>,
    private readonly dataAggregator: MriDataAggregatorService,
  ) {}

  /**
   * Sync all renewals - runs at 2 AM daily
   */
  @Cron('0 2 * * *', {
    name: 'renewal-sync-all',
    timeZone: 'America/New_York',
  })
  async syncAllRenewals(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('🔄 Starting scheduled sync of all renewals');

    try {
      const renewals = await this.renewalModel.find({}).exec();
      this.logger.log(`📋 Found ${renewals.length} renewals to sync`);

      let successCount = 0;
      let errorCount = 0;

      // Process in batches to avoid overwhelming MRI APIs
      const batchSize = 10;
      for (let i = 0; i < renewals.length; i += batchSize) {
        const batch = renewals.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (renewal) => {
          try {
            await this.syncSingleRenewal(renewal);
            successCount++;
          } catch (error) {
            this.logger.error(`Failed to sync renewal ${renewal._id}: ${error.message}`);
            errorCount++;
          }
        });

        await Promise.allSettled(batchPromises);
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < renewals.length) {
          await this.delay(1000);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Renewal sync complete: ${successCount} success, ${errorCount} errors in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Renewal sync failed after ${duration}ms: ${error.message}`);
    }
  }

  /**
   * Sync renewals for a specific property
   */
  async syncPropertyRenewals(propertyId: string): Promise<{ success: number; errors: number }> {
    const startTime = Date.now();
    this.logger.log(`🔄 Starting sync for property ${propertyId}`);

    try {
      const renewals = await this.renewalModel.find({ propertyId }).exec();
      this.logger.log(`📋 Found ${renewals.length} renewals for property ${propertyId}`);

      let successCount = 0;
      let errorCount = 0;

      const syncPromises = renewals.map(async (renewal) => {
        try {
          await this.syncSingleRenewal(renewal);
          successCount++;
        } catch (error) {
          this.logger.error(`Failed to sync renewal ${renewal._id}: ${error.message}`);
          errorCount++;
        }
      });

      await Promise.allSettled(syncPromises);

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Property ${propertyId} sync complete: ${successCount} success, ${errorCount} errors in ${duration}ms`);

      return { success: successCount, errors: errorCount };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Property ${propertyId} sync failed after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync a single renewal
   */
  async syncSingleRenewal(renewal: RenewalDocument): Promise<void> {
    try {
      this.logger.log(`🔄 Syncing renewal ${renewal.tenantId} (${renewal.mriLeaseId})`);

      // Aggregate MRI data
      const mriData = await this.dataAggregator.aggregateLeaseData(
        renewal.propertyId,
        renewal.mriLeaseId
      );

      // Update the renewal document
      await this.renewalModel.updateOne(
        { _id: renewal._id },
        {
          $set: {
            // Financial data
            monthlyRent: mriData.monthlyRent,
            cam: mriData.cam,
            ins: mriData.ins,
            tax: mriData.tax,
            totalDueMonthly: mriData.totalDueMonthly,
            balanceForward: mriData.balanceForward,
            cashReceived: mriData.cashReceived,
            balanceDue: mriData.balanceDue,
            totalArBalance: mriData.totalArBalance,
            
            // Aging buckets
            days0To30: mriData.days0To30,
            days31To60: mriData.days31To60,
            days61Plus: mriData.days61Plus,
            
            // Escalations
            rentEscalations: mriData.rentEscalations,
            
            // Raw data for debugging
            mriData: mriData.rawData,
            
            // Update sync timestamp
            lastSyncAt: new Date(),
          }
        }
      );

      this.logger.log(`✅ Successfully synced renewal ${renewal.tenantId}`);

    } catch (error) {
      this.logger.error(`❌ Failed to sync renewal ${renewal.tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync all properties - implements RenewalSyncer interface
   */
  async syncAllProperties(): Promise<SyncResult> {
    const startTime = Date.now();
    this.logger.log('🔄 Starting sync of all properties');

    try {
      // Get all unique property IDs from renewals
      const propertyIds = await this.renewalModel.distinct('propertyId').exec();
      this.logger.log(`📋 Found ${propertyIds.length} unique properties to sync`);

      if (propertyIds.length === 0) {
        return {
          success: true,
          propertiesProcessed: 0,
          renewalsCreated: 0,
          renewalsUpdated: 0,
          errors: [],
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Use batch processing to sync all properties
      const batchResult = await this.syncPropertiesBatch(propertyIds);
      
      const duration = Date.now() - startTime;
      const success = batchResult.errors.length === 0;

      this.logger.log(`✅ All properties sync complete: ${batchResult.propertiesProcessed} properties, ${batchResult.renewalsCreated} renewals, ${batchResult.errors.length} errors in ${duration}ms`);

      return {
        success,
        propertiesProcessed: batchResult.propertiesProcessed,
        renewalsCreated: batchResult.renewalsCreated,
        renewalsUpdated: batchResult.renewalsUpdated,
        errors: batchResult.errors,
        duration,
        timestamp: new Date(),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ All properties sync failed after ${duration}ms: ${error.message}`);
      
      return {
        success: false,
        propertiesProcessed: 0,
        renewalsCreated: 0,
        renewalsUpdated: 0,
        errors: [error.message],
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Sync properties in batch - used by BullMQ processor
   */
  async syncPropertiesBatch(propertyIds: string[]): Promise<BatchSyncResult> {
    const startTime = Date.now();
    this.logger.log(`🔄 Starting batch sync for ${propertyIds.length} properties`);

    let totalCreated = 0;
    let totalUpdated = 0;
    let propertiesProcessed = 0;
    const errors: string[] = [];

    // Process each property in the batch
    for (const propertyId of propertyIds) {
      try {
        const result = await this.syncPropertyRenewals(propertyId);
        totalCreated += result.success; // Assuming success count represents renewals processed
        propertiesProcessed++;
        
        this.logger.log(`✅ Property ${propertyId} synced: ${result.success} renewals processed`);
      } catch (error) {
        const errorMsg = `Property ${propertyId} sync failed: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`📊 Batch sync complete: ${propertiesProcessed}/${propertyIds.length} properties, ${totalCreated} renewals, ${errors.length} errors in ${duration}ms`);

    return {
      renewalsCreated: totalCreated,
      renewalsUpdated: 0, // Current implementation doesn't distinguish created vs updated
      propertiesProcessed,
      errors,
    };
  }

  /**
   * Manual sync trigger for API endpoint
   */
  async triggerManualSync(propertyId?: string): Promise<{ message: string; stats: any }> {
    this.logger.log(`🔄 Manual sync triggered${propertyId ? ` for property ${propertyId}` : ' for all properties'}`);

    if (propertyId) {
      const stats = await this.syncPropertyRenewals(propertyId);
      return {
        message: `Property ${propertyId} sync completed`,
        stats
      };
    } else {
      await this.syncAllRenewals();
      return {
        message: 'Full sync completed',
        stats: { message: 'Check logs for detailed stats' }
      };
    }
  }

  /**
   * Sync a specific property - implements RenewalSyncer interface
   */
  async syncProperty(propertyId: string): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.syncPropertyRenewals(propertyId);
      const duration = Date.now() - startTime;
      
      return {
        success: result.errors === 0,
        propertiesProcessed: 1,
        renewalsCreated: result.success,
        renewalsUpdated: 0, // Current implementation doesn't distinguish
        errors: result.errors > 0 ? [`Property ${propertyId} had ${result.errors} errors`] : [],
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        propertiesProcessed: 0,
        renewalsCreated: 0,
        renewalsUpdated: 0,
        errors: [error.message],
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Sync incremental changes - implements RenewalSyncer interface
   */
  async syncIncremental(since?: Date): Promise<SyncResult> {
    const startTime = Date.now();
    this.logger.log(`🔄 Starting incremental sync${since ? ` since ${since.toISOString()}` : ''}`);

    try {
      // For now, delegate to syncAllProperties as we don't have incremental logic
      // In a real implementation, this would filter renewals by lastSyncAt or similar
      const result = await this.syncAllProperties();
      
      this.logger.log(`✅ Incremental sync delegated to full sync`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Incremental sync failed: ${error.message}`);
      
      return {
        success: false,
        propertiesProcessed: 0,
        renewalsCreated: 0,
        renewalsUpdated: 0,
        errors: [error.message],
        duration,
        timestamp: new Date(),
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}