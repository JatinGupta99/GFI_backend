import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeasingService } from './leasing.service';

@Injectable()
export class RenewalsCronService {
  private readonly logger = new Logger(RenewalsCronService.name);

  constructor(private readonly leasingService: LeasingService) {}

  /**
   * Sync renewals every 6 hours
   * Runs at: 00:00, 06:00, 12:00, 18:00
   */
  @Cron(CronExpression.EVERY_6_HOURS, {
    name: 'renewals-sync',
    timeZone: 'America/New_York',
  })
  async handleRenewalsSync() {
    this.logger.log('Starting scheduled renewals sync');

    try {
      const { batchId, jobIds, totalProperties } = await this.leasingService.queueRenewalsSync({
        delayBetweenJobs: 5000, // 5 seconds between jobs
      });

      this.logger.log(`Scheduled renewals sync queued: Batch ${batchId} with ${jobIds.length} jobs for ${totalProperties} properties`);
    } catch (error) {
      this.logger.error(
        `Failed to queue scheduled renewals sync: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Optional: Sync renewals every morning at 6 AM
   */
  @Cron('0 6 * * *', {
    name: 'renewals-morning-sync',
    timeZone: 'America/New_York',
  })
  async handleMorningSync() {
    this.logger.log('Starting morning renewals sync');

    try {
      const { batchId, jobIds, totalProperties } = await this.leasingService.queueRenewalsSync({
        delayBetweenJobs: 5000, // 5 seconds between jobs
      });

      this.logger.log(`Morning renewals sync queued: Batch ${batchId} with ${jobIds.length} jobs for ${totalProperties} properties`);
    } catch (error) {
      this.logger.error(
        `Failed to queue morning renewals sync: ${error.message}`,
        error.stack,
      );
    }
  }
}
