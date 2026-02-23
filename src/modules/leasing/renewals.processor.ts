import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LeasingService } from './leasing.service';
import { UpcomingRenewal } from './dto/upcoming-renewal.dto';

export interface RenewalsSyncJob {
  propertyIds: string[];
  batchSize: number;
  delayBetweenBatches: number;
}

export interface RenewalsSyncResult {
  success: boolean;
  totalRenewals: number;
  propertiesProcessed: number;
  errors: string[];
  duration: number;
}

@Processor('renewals-sync', {
  concurrency: 1, 
})
export class RenewalsProcessor extends WorkerHost {
  private readonly logger = new Logger(RenewalsProcessor.name);

  constructor(private readonly leasingService: LeasingService) {
    super();
  }

  async process(job: Job<RenewalsSyncJob>): Promise<RenewalsSyncResult> {
    const startTime = Date.now();
    const { propertyIds, batchSize, delayBetweenBatches } = job.data;

    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    this.logger.log(
      `🚀 Starting renewals sync job ${job.id}`,
    );
    this.logger.log(
      `📊 Total properties: ${propertyIds.length}`,
    );
    this.logger.log(
      `📦 Batch size: ${batchSize} properties per batch`,
    );
    this.logger.log(
      `⏱️  Delay between batches: ${delayBetweenBatches / 1000}s`,
    );
    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );

    const allRenewals: UpcomingRenewal[] = [];
    const errors: string[] = [];
    let propertiesProcessed = 0;
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

      this.logger.log(
        `\n┌─────────────────────────────────────────────────────────────┐`,
      );
      this.logger.log(
        `│ 📦 BATCH ${batchNumber}/${totalBatches} - Processing ${batch.length} properties`,
      );
      this.logger.log(
        `│ Properties: ${batch.join(', ')}`,
      );
      this.logger.log(
        `└─────────────────────────────────────────────────────────────┘`,
      );

      let batchRenewalsCount = 0;

      // Process properties SEQUENTIALLY within the batch to avoid rate limits
      for (let propIndex = 0; propIndex < batch.length; propIndex++) {
        const propertyId = batch[propIndex];
        const propStartTime = Date.now();

        try {
          this.logger.log(
            `  ├─ [${propIndex + 1}/${batch.length}] Processing property ${propertyId}...`,
          );

          const renewals = await this.leasingService.getUpcomingRenewals(
            propertyId,
          );
          allRenewals.push(...renewals);
          propertiesProcessed++;
          batchRenewalsCount += renewals.length;

          const propDuration = Date.now() - propStartTime;
          this.logger.log(
            `  │  ✓ Success: ${renewals.length} renewals found (${propDuration}ms)`,
          );

          // Small delay between properties within the batch
          if (propIndex < batch.length - 1) {
            this.logger.log(`  │  ⏳ Waiting 2s before next property...`);
            await this.delay(2000); // 2 seconds between properties
          }
        } catch (error) {
          const propDuration = Date.now() - propStartTime;
          const errorMsg = `Property ${propertyId}: ${error.message}`;
          this.logger.error(
            `  │  ✗ Failed: ${error.message} (${propDuration}ms)`,
          );
          errors.push(errorMsg);
        }
      }

      const batchDuration = Date.now() - batchStartTime;
      this.logger.log(
        `  └─ Batch ${batchNumber} complete: ${batchRenewalsCount} renewals in ${(batchDuration / 1000).toFixed(1)}s`,
      );

      // Summary after each batch
      this.logger.log(
        `\n📈 Progress: ${propertiesProcessed}/${propertyIds.length} properties | ${allRenewals.length} total renewals | ${errors.length} errors`,
      );

      // Delay between batches (except for the last batch)
      if (i + batchSize < propertyIds.length) {
        this.logger.log(
          `\n⏸️  Waiting ${delayBetweenBatches / 1000}s before batch ${batchNumber + 1}/${totalBatches} to respect rate limits...`,
        );
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        await this.delay(delayBetweenBatches);
      }
    }

    const duration = Date.now() - startTime;

    await job.updateProgress({
      current: propertyIds.length,
      total: propertyIds.length,
      status: 'Completed',
    });

    this.logger.log(
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    this.logger.log(
      `✅ Renewals sync job ${job.id} COMPLETED`,
    );
    this.logger.log(
      `📊 Results:`,
    );
    this.logger.log(
      `   • Total renewals: ${allRenewals.length}`,
    );
    this.logger.log(
      `   • Properties processed: ${propertiesProcessed}/${propertyIds.length}`,
    );
    this.logger.log(
      `   • Errors: ${errors.length}`,
    );
    this.logger.log(
      `   • Duration: ${(duration / 1000).toFixed(1)}s (${(duration / 60000).toFixed(1)} minutes)`,
    );
    this.logger.log(
      `   • Success rate: ${((propertiesProcessed / propertyIds.length) * 100).toFixed(1)}%`,
    );
    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );

    return {
      success: errors.length === 0,
      totalRenewals: allRenewals.length,
      propertiesProcessed,
      errors,
      duration,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<RenewalsSyncJob, RenewalsSyncResult>) {
    const { totalRenewals, propertiesProcessed, duration } = job.returnvalue;
    this.logger.log(
      `Job ${job.id} completed: ${totalRenewals} renewals from ${propertiesProcessed} properties in ${duration}ms`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RenewalsSyncJob>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
