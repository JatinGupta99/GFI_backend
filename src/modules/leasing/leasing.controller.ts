import { Controller, Get, Post, Query, Param, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { LeasingService } from './leasing.service';
import { GetRenewalsQueryDto } from './dto/get-renewals-query.dto';

@Controller('leasing/renewals')
@UseInterceptors(CacheInterceptor)
export class LeasingController {
    constructor(private readonly service: LeasingService) { }

    /**
     * Get renewals for a specific property (paginated)
     */
    @Get()
    async getUpcomingRenewals(
        @Query() query: GetRenewalsQueryDto
    ) {
        const { propertyId, limit, page } = query;
        const data = await this.service.getUpcomingRenewals(propertyId, page, limit);

        return {
            data,
            meta: {
                page,
                limit,
            }
        };
    }

    /**
     * Trigger background sync job for all properties
     * Returns job ID for tracking
     */
    @Post('sync')
    async syncAllRenewals() {
        const { jobId } = await this.service.queueRenewalsSync();
        return {
            message: 'Renewals sync job queued successfully. Cache cleared.',
            jobId,
            statusUrl: `/leasing/renewals/sync/${jobId}`,
        };
    }

    /**
     * Clear/stop all pending and active sync jobs
     */
    @Post('sync/clear')
    async clearSyncQueue() {
        const result = await this.service.clearSyncQueue();
        return {
            message: 'Sync queue cleared successfully',
            ...result,
        };
    }

    /**
     * Clear all renewal-related cache
     */
    @Post('cache/clear')
    async clearCache() {
        await this.service.clearRenewalsCache();
        return {
            message: 'Renewals cache cleared successfully',
        };
    }

    /**
     * Get sync job status and progress
     */
    @Get('sync/:jobId')
    async getSyncStatus(@Param('jobId') jobId: string) {
        return this.service.getJobStatus(jobId);
    }

    /**
     * Get cached renewals from last successful sync
     * Fast endpoint that returns immediately
     */
    @Get('cached')
    async getCachedRenewals() {
        const data = await this.service.getCachedRenewals();
        return {
            data,
            meta: {
                total: data.length,
                cached: true,
            },
        };
    }

    /**
     * @deprecated Use POST /sync and GET /cached instead
     * Legacy endpoint - fetches renewals directly from MRI
     * If propertyId is provided, fetches only that property
     * Otherwise fetches all properties
     */
    @Get('all')
    async getAllUpcomingRenewals(@Query('propertyId') propertyId?: string) {
        const data = propertyId 
            ? await this.service.getUpcomingRenewals(propertyId, 1, 50)
            : await this.service.getAllUpcomingRenewals();
            
        return {
            data,
            meta: {
                total: data.length,
                propertyId: propertyId || 'all',
                deprecated: true,
                message: propertyId 
                    ? 'Use GET /renewals?propertyId=X instead'
                    : 'Use POST /sync to trigger background sync, then GET /cached to retrieve results',
            },
        };
    }
}
