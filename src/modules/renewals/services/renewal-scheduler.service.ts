import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RenewalSyncService } from './renewal-sync.service';

@Injectable()
export class RenewalSchedulerService {
  private readonly logger = new Logger(RenewalSchedulerService.name);

  constructor(private readonly syncService: RenewalSyncService) {}

  /**
   * Sync renewals every day at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailySync() {
    this.logger.log('🕐 Starting scheduled daily renewal sync...');
    
    try {
      const result = await this.syncService.syncAllProperties();
      this.logger.log(`✅ Scheduled sync completed: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`❌ Scheduled sync failed: ${error.message}`);
    }
  }

  /**
   * Sync renewals every 6 hours
   * Uncomment if you want more frequent syncs
   */
  // @Cron(CronExpression.EVERY_6_HOURS)
  // async handleFrequentSync() {
  //   this.logger.log('🕐 Starting 6-hour renewal sync...');
  //   
  //   try {
  //     const result = await this.syncService.syncIncremental();
  //     this.logger.log(`✅ Incremental sync completed: ${JSON.stringify(result)}`);
  //   } catch (error) {
  //     this.logger.error(`❌ Incremental sync failed: ${error.message}`);
  //   }
  // }

  /**
   * Sync renewals every Monday at 1 AM
   * Uncomment for weekly full sync
   */
  // @Cron(CronExpression.MONDAY_TO_FRIDAY_AT_1AM)
  // async handleWeeklySync() {
  //   this.logger.log('🕐 Starting weekly renewal sync...');
  //   
  //   try {
  //     const result = await this.syncService.syncAllProperties();
  //     this.logger.log(`✅ Weekly sync completed: ${JSON.stringify(result)}`);
  //   } catch (error) {
  //     this.logger.error(`❌ Weekly sync failed: ${error.message}`);
  //   }
  // }
}
