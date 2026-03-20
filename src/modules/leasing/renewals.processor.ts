import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LeasingService } from './leasing.service';

// Single property sync job
export interface RenewalsSyncJob {
  propertyId: string;
  batchId?: string; // Optional: to group related jobs
  propertyIndex?: number; // Optional: for tracking progress
  totalProperties?: number; // Optional: for tracking progress
}

export interface RenewalsSyncResult {
  success: boolean;
  propertyId: string;
  renewalsCount: number;
  renewalsSaved: number;
  errors: string[];
  duration: number;
}

@Processor('renewals-sync', {
  concurrency: 1, // Process 1 property at a time to avoid rate limits
})
export class RenewalsProcessor extends WorkerHost {
  private readonly logger = new Logger(RenewalsProcessor.name);

  constructor(
    private readonly leasingService: LeasingService,
  ) {
    super();
  }

  async process(job: Job<RenewalsSyncJob>): Promise<RenewalsSyncResult> {
      const startTime = Date.now();
      const { propertyId, batchId, propertyIndex, totalProperties } = job.data;

      this.logger.log(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      );
      this.logger.log(
        `🚀 Starting renewal sync for property ${propertyId} (Job ${job.id})`,
      );
      if (batchId) {
        this.logger.log(`📦 Batch ID: ${batchId}`);
      }
      if (propertyIndex && totalProperties) {
        this.logger.log(`📊 Progress: ${propertyIndex}/${totalProperties}`);
      }
      this.logger.log(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      );

      const errors: string[] = [];
      let renewalsCount = 0;
      let renewalsSaved = 0;

      try {
        // Update progress
        await job.updateProgress({
          status: 'fetching',
          propertyId,
          step: 'Fetching and syncing renewals from MRI in batches',
        });

        this.logger.log(`🔄 Fetching and syncing renewals from MRI for property ${propertyId}...`);

        // Fetch and sync renewals in batches (saves to DB after each batch)
        const result = await this.leasingService.fetchAndSyncRenewalsFromMRI(propertyId, job.id!);

        renewalsCount = result.processedLeases;
        renewalsSaved = result.savedRenewals;

        this.logger.log(`✅ Processed ${result.processedLeases}/${result.totalLeases} leases, saved ${result.savedRenewals} renewals`);

        if (result.failedLeases > 0) {
          this.logger.warn(`⚠️  ${result.failedLeases} leases failed to process`);
        }

        // Update progress
        await job.updateProgress({
          status: 'completed',
          propertyId,
          renewalsCount,
          renewalsSaved,
          step: 'Completed',
        });

        const duration = Date.now() - startTime;

        this.logger.log(
          `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        );
        this.logger.log(
          `✅ Property ${propertyId} sync COMPLETED`,
        );
        this.logger.log(
          `📊 Results:`,
        );
        this.logger.log(
          `   • Total leases: ${result.totalLeases}`,
        );
        this.logger.log(
          `   • Processed leases: ${result.processedLeases}`,
        );
        this.logger.log(
          `   • Renewals saved: ${result.savedRenewals}`,
        );
        this.logger.log(
          `   • Failed leases: ${result.failedLeases}`,
        );
        this.logger.log(
          `   • Duration: ${(duration / 1000).toFixed(1)}s`,
        );
        this.logger.log(
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        );

        return {
          success: true,
          propertyId,
          renewalsCount,
          renewalsSaved,
          errors,
          duration,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = `Property ${propertyId}: ${error.message}`;

        this.logger.error(
          `❌ Property ${propertyId} sync FAILED: ${error.message}`,
          error.stack,
        );

        errors.push(errorMsg);

        // Update progress with error
        await job.updateProgress({
          status: 'failed',
          propertyId,
          error: error.message,
          step: 'Failed',
        });

        // Even if failed, return what was saved
        this.logger.log(
          `📊 Partial results before failure: ${renewalsSaved} renewals saved`,
        );

        return {
          success: false,
          propertyId,
          renewalsCount,
          renewalsSaved,
          errors,
          duration,
        };
      }
    }


  @OnWorkerEvent('completed')
  onCompleted(job: Job<RenewalsSyncJob, RenewalsSyncResult>) {
    const { propertyId, renewalsCount, renewalsSaved, duration } = job.returnvalue;
    this.logger.log(
      `Job ${job.id} completed: Property ${propertyId} - ${renewalsCount} renewals fetched, ${renewalsSaved} saved in ${duration}ms`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RenewalsSyncJob>, error: Error) {
    const { propertyId } = job.data;
    this.logger.error(
      `Job ${job.id} failed for property ${propertyId}: ${error.message}`,
      error.stack,
    );
  }
}
