import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RenewalSyncService, RenewalSyncJob } from '../services/renewal-sync.service';
import { SyncResult } from '../interfaces/renewal-provider.interface';

@Processor('renewal-sync', {
  concurrency: 1, // Process one sync job at a time
})
export class RenewalSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(RenewalSyncProcessor.name);

  constructor(private readonly renewalSyncService: RenewalSyncService) {
    super();
  }

  async process(job: Job<RenewalSyncJob>): Promise<SyncResult> {
    const startTime = Date.now();
    const { type, propertyIds, since, batchSize = 5, delayBetweenBatches = 2000 } = job.data;

    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`🔄 Starting renewal sync job ${job.id} (${type})`);
    this.logger.log(`📊 Properties: ${propertyIds?.length || 0}`);
    this.logger.log(`📦 Batch size: ${batchSize}`);
    this.logger.log(`⏱️  Delay between batches: ${delayBetweenBatches}ms`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (!propertyIds?.length) {
      throw new Error('No property IDs provided for sync');
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let propertiesProcessed = 0;
    const errors: string[] = [];
    const totalBatches = Math.ceil(propertyIds.length / batchSize);

    // Process properties in batches
    for (let i = 0; i < propertyIds.length; i += batchSize) {
      const batch = propertyIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batchStartTime = Date.now();

      await job.updateProgress({
        current: i,
        total: propertyIds.length,
        batch: batchNumber,
        totalBatches,
        status: `Processing batch ${batchNumber}/${totalBatches}`,
      });

      this.logger.log(`\n┌─────────────────────────────────────────────────────────────┐`);
      this.logger.log(`│ 📦 BATCH ${batchNumber}/${totalBatches} - Processing ${batch.length} properties`);
      this.logger.log(`│ Properties: ${batch.join(', ')}`);
      this.logger.log(`└─────────────────────────────────────────────────────────────┘`);

      try {
        // Process batch with controlled concurrency
        const batchResult = await this.renewalSyncService.syncPropertiesBatch(batch);
        
        totalCreated += batchResult.renewalsCreated;
        totalUpdated += batchResult.renewalsUpdated;
        propertiesProcessed += batchResult.propertiesProcessed;
        errors.push(...batchResult.errors);

        const batchDuration = Date.now() - batchStartTime;
        this.logger.log(
          `  └─ Batch ${batchNumber} complete: ${batchResult.renewalsCreated} created, ${batchResult.renewalsUpdated} updated in ${(batchDuration / 1000).toFixed(1)}s`
        );

        // Progress update
        this.logger.log(
          `\n📈 Progress: ${propertiesProcessed}/${propertyIds.length} properties | ${totalCreated + totalUpdated} total renewals | ${errors.length} errors`
        );

        // Delay between batches (except for the last batch)
        if (i + batchSize < propertyIds.length) {
          this.logger.log(
            `\n⏸️  Waiting ${delayBetweenBatches / 1000}s before batch ${batchNumber + 1}/${totalBatches}...`
          );
          await this.delay(delayBetweenBatches);
        }
      } catch (error) {
        const errorMsg = `Batch ${batchNumber} failed: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const duration = Date.now() - startTime;

    await job.updateProgress({
      current: propertyIds.length,
      total: propertyIds.length,
      status: 'Completed',
    });

    this.logger.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`✅ Renewal sync job ${job.id} COMPLETED`);
    this.logger.log(`📊 Results:`);
    this.logger.log(`   • Renewals created: ${totalCreated}`);
    this.logger.log(`   • Renewals updated: ${totalUpdated}`);
    this.logger.log(`   • Properties processed: ${propertiesProcessed}/${propertyIds.length}`);
    this.logger.log(`   • Errors: ${errors.length}`);
    this.logger.log(`   • Duration: ${(duration / 1000).toFixed(1)}s (${(duration / 60000).toFixed(1)} minutes)`);
    this.logger.log(`   • Success rate: ${((propertiesProcessed / propertyIds.length) * 100).toFixed(1)}%`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return {
      success: errors.length === 0,
      propertiesProcessed,
      renewalsCreated: totalCreated,
      renewalsUpdated: totalUpdated,
      errors,
      duration,
      timestamp: new Date(),
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<RenewalSyncJob, SyncResult>) {
    const { renewalsCreated, renewalsUpdated, propertiesProcessed, duration } = job.returnvalue;
    this.logger.log(
      `Job ${job.id} completed: ${renewalsCreated + renewalsUpdated} renewals synced from ${propertiesProcessed} properties in ${duration}ms`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RenewalSyncJob>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job<RenewalSyncJob>, progress: any) {
    this.logger.debug(`Job ${job.id} progress: ${JSON.stringify(progress)}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}