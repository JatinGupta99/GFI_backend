import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LeasingService } from './leasing.service';
import { UpcomingRenewal } from './dto/upcoming-renewal.dto';

export interface IncrementalSyncJob {
  propertyIds: string[];
  leasesPerCycle: number; // Number of leases to process per 5-minute cycle
  delayBetweenCycles: number; // 5 minutes (300000ms)
}

export interface IncrementalSyncResult {
  success: boolean;
  totalRenewals: number;
  leasesProcessed: number;
  propertiesProcessed: number;
  cyclesCompleted: number;
  errors: string[];
  duration: number;
}

interface PropertyLeaseState {
  propertyId: string;
  totalLeases: number;
  processedLeases: number;
  leases: any[];
  offersMap: Map<string, any>;
  emeaMap: Map<string, any>;
}

@Processor('renewals-incremental-sync', {
  concurrency: 1,
})
export class IncrementalRenewalsProcessor extends WorkerHost {
  private readonly logger = new Logger(IncrementalRenewalsProcessor.name);

  constructor(private readonly leasingService: LeasingService) {
    super();
  }

  async process(job: Job<IncrementalSyncJob>): Promise<IncrementalSyncResult> {
    const startTime = Date.now();
    const { propertyIds, leasesPerCycle, delayBetweenCycles } = job.data;

    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    this.logger.log(
      `🚀 Starting INCREMENTAL renewals sync job ${job.id}`,
    );
    this.logger.log(
      `📊 Total properties: ${propertyIds.length}`,
    );
    this.logger.log(
      `🔄 Leases per 5-minute cycle: ${leasesPerCycle}`,
    );
    this.logger.log(
      `⏱️  Delay between cycles: ${delayBetweenCycles / 1000}s (${delayBetweenCycles / 60000} minutes)`,
    );
    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );

    const allRenewals: UpcomingRenewal[] = [];
    const errors: string[] = [];
    const propertyStates: PropertyLeaseState[] = [];
    let totalLeasesProcessed = 0;
    let cycleNumber = 0;

    // Step 1: Fetch all leases for all properties (property-level APIs only)
    this.logger.log(`\n📥 PHASE 1: Fetching property-level data for ${propertyIds.length} properties...`);
    
    for (const propertyId of propertyIds) {
      try {
        this.logger.log(`  Fetching leases for property ${propertyId}...`);
        const leases = await this.leasingService.getPropertyLeases(propertyId);
        
        if (leases.length === 0) {
          this.logger.log(`  ⚠️  No leases found for property ${propertyId}`);
          continue;
        }

        const [offers, emea] = await this.leasingService.getPropertyMetadata(propertyId);
        
        propertyStates.push({
          propertyId,
          totalLeases: leases.length,
          processedLeases: 0,
          leases,
          offersMap: new Map(offers.map(o => [o.LeaseID, o])),
          emeaMap: new Map(emea.map(e => [e.LeaseId, e])),
        });

        this.logger.log(`  ✓ Property ${propertyId}: ${leases.length} leases queued`);
      } catch (error) {
        const errorMsg = `Failed to fetch leases for property ${propertyId}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const totalLeases = propertyStates.reduce((sum, p) => sum + p.totalLeases, 0);
    const totalCycles = Math.ceil(totalLeases / leasesPerCycle);

    this.logger.log(`\n📊 Summary:`);
    this.logger.log(`   • Total leases across all properties: ${totalLeases}`);
    this.logger.log(`   • Estimated cycles needed: ${totalCycles}`);
    this.logger.log(`   • Estimated total time: ${(totalCycles * delayBetweenCycles / 60000).toFixed(1)} minutes`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Step 2: Process leases incrementally (1 lease per cycle)
    this.logger.log(`📥 PHASE 2: Processing leases incrementally...`);

    while (totalLeasesProcessed < totalLeases) {
      cycleNumber++;
      const cycleStartTime = Date.now();

      this.logger.log(
        `\n┌─────────────────────────────────────────────────────────────┐`,
      );
      this.logger.log(
        `│ 🔄 CYCLE ${cycleNumber}/${totalCycles} - Processing ${leasesPerCycle} lease(s)`,
      );
      this.logger.log(
        `│ Progress: ${totalLeasesProcessed}/${totalLeases} leases completed`,
      );
      this.logger.log(
        `└─────────────────────────────────────────────────────────────┘`,
      );

      await job.updateProgress({
        current: totalLeasesProcessed,
        total: totalLeases,
        cycle: cycleNumber,
        totalCycles,
        status: `Processing cycle ${cycleNumber}/${totalCycles}`,
      });

      let leasesProcessedThisCycle = 0;

      // Process leases from properties in round-robin fashion
      for (const propertyState of propertyStates) {
        if (leasesProcessedThisCycle >= leasesPerCycle) break;
        if (propertyState.processedLeases >= propertyState.totalLeases) continue;

        const lease = propertyState.leases[propertyState.processedLeases];
        
        try {
          this.logger.log(
            `  ├─ Property ${propertyState.propertyId} | Lease ${propertyState.processedLeases + 1}/${propertyState.totalLeases}: ${lease.LeaseID}`,
          );

          const renewal = await this.leasingService.processLease(
            propertyState.propertyId,
            lease,
            propertyState.offersMap,
            propertyState.emeaMap,
          );

          allRenewals.push(renewal);
          propertyState.processedLeases++;
          totalLeasesProcessed++;
          leasesProcessedThisCycle++;

          this.logger.log(`  │  ✓ Success: Renewal data processed`);
        } catch (error) {
          const errorMsg = `Property ${propertyState.propertyId}, Lease ${lease.LeaseID}: ${error.message}`;
          this.logger.error(`  │  ✗ Failed: ${error.message}`);
          errors.push(errorMsg);
          propertyState.processedLeases++;
          totalLeasesProcessed++;
          leasesProcessedThisCycle++;
        }
      }

      const cycleDuration = Date.now() - cycleStartTime;
      this.logger.log(
        `  └─ Cycle ${cycleNumber} complete: ${leasesProcessedThisCycle} lease(s) in ${(cycleDuration / 1000).toFixed(1)}s`,
      );

      this.logger.log(
        `\n📈 Overall Progress: ${totalLeasesProcessed}/${totalLeases} leases | ${allRenewals.length} renewals | ${errors.length} errors`,
      );

      // Wait before next cycle (except for the last cycle)
      if (totalLeasesProcessed < totalLeases) {
        this.logger.log(
          `\n⏸️  Waiting ${delayBetweenCycles / 1000}s (${delayBetweenCycles / 60000} min) before cycle ${cycleNumber + 1}/${totalCycles}...`,
        );
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        await this.delay(delayBetweenCycles);
      }
    }

    const duration = Date.now() - startTime;
    const propertiesProcessed = propertyStates.filter(p => p.processedLeases > 0).length;

    await job.updateProgress({
      current: totalLeases,
      total: totalLeases,
      status: 'Completed',
    });

    this.logger.log(
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    this.logger.log(
      `✅ Incremental renewals sync job ${job.id} COMPLETED`,
    );
    this.logger.log(
      `📊 Results:`,
    );
    this.logger.log(
      `   • Total renewals: ${allRenewals.length}`,
    );
    this.logger.log(
      `   • Leases processed: ${totalLeasesProcessed}/${totalLeases}`,
    );
    this.logger.log(
      `   • Properties processed: ${propertiesProcessed}/${propertyIds.length}`,
    );
    this.logger.log(
      `   • Cycles completed: ${cycleNumber}`,
    );
    this.logger.log(
      `   • Errors: ${errors.length}`,
    );
    this.logger.log(
      `   • Duration: ${(duration / 1000).toFixed(1)}s (${(duration / 60000).toFixed(1)} minutes)`,
    );
    this.logger.log(
      `   • Success rate: ${((totalLeasesProcessed - errors.length) / totalLeasesProcessed * 100).toFixed(1)}%`,
    );
    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );

    return {
      success: errors.length === 0,
      totalRenewals: allRenewals.length,
      leasesProcessed: totalLeasesProcessed,
      propertiesProcessed,
      cyclesCompleted: cycleNumber,
      errors,
      duration,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<IncrementalSyncJob, IncrementalSyncResult>) {
    const { totalRenewals, leasesProcessed, cyclesCompleted, duration } = job.returnvalue;
    this.logger.log(
      `Job ${job.id} completed: ${totalRenewals} renewals from ${leasesProcessed} leases in ${cyclesCompleted} cycles (${(duration / 60000).toFixed(1)} min)`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IncrementalSyncJob>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
