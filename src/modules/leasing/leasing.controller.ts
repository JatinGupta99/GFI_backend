import { Controller, Get, Post, Query, Param, UseInterceptors, Body, HttpCode, HttpStatus, Req, NotFoundException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { LeasingService } from './leasing.service';
import { GetRenewalsQueryDto } from './dto/get-renewals-query.dto';
import { SendExecutionEmailDto } from './dto/send-execution-email.dto';
import { LeaseEmailService } from './services/lease-email.service';

@Controller('leasing')
@UseInterceptors(CacheInterceptor)
export class LeasingController {
    private readonly logger = new Logger(LeasingController.name);

    constructor(
        private readonly service: LeasingService,
        private readonly leaseEmailService: LeaseEmailService,
    ) { }

    /**
     * Get renewals for a specific property (paginated)
     */
    @Get('renewals')
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
    @Post('renewals/sync')
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
    @Post('renewals/sync/clear')
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
    @Post('renewals/cache/clear')
    async clearCache() {
        await this.service.clearRenewalsCache();
        return {
            message: 'Renewals cache cleared successfully',
        };
    }

    /**
     * Get sync job status and progress
     */
    @Get('renewals/sync/:jobId')
    async getSyncStatus(@Param('jobId') jobId: string) {
        return this.service.getJobStatus(jobId);
    }

    /**
     * Get cached renewals from last successful sync
     * Fast endpoint that returns immediately
     */
    @Get('renewals/cached')
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
    @Get('renewals/all')
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
                    ? 'Use GET /leasing/renewals?propertyId=X instead'
                    : 'Use POST /leasing/renewals/sync to trigger background sync, then GET /leasing/renewals/cached to retrieve results',
            },
        };
    }

    /**
     * Send lease execution email
     * POST /leasing/:leaseId/send-execution-email
     * 
     * Sends a custom email with lease execution copy and DocuSign link
     */
    @Post(':leaseId/send-execution-email')
    @HttpCode(HttpStatus.OK)
    async sendExecutionEmail(
        @Param('leaseId') leaseId: string,
        @Body() dto: SendExecutionEmailDto,
        @Req() req: any,
    ): Promise<{
        success: boolean;
        message: string;
        emailId?: string;
        taskId?: string;
        followUpEmailId?: string;
    }> {
        this.logger.log(`Received request to send execution email for lease ${leaseId}`);

        try {
            // Validate lease ID
            if (!leaseId || leaseId.trim() === '') {
                throw new BadRequestException('Lease ID is required');
            }

            // Get user from request (set by auth middleware)
            const user = req.user;
            if (!user) {
                throw new BadRequestException('User not authenticated');
            }

            // Send execution email
            const result = await this.leaseEmailService.sendExecutionEmail(
                leaseId,
                dto,
                user,
            );

            this.logger.log(
                `Successfully sent execution email for lease ${leaseId} to ${dto.to}`,
            );

            return {
                success: true,
                message: 'Email sent successfully',
                ...result,
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            this.logger.error(
                `Failed to send execution email for lease ${leaseId}`,
                error.stack,
            );

            throw new InternalServerErrorException(
                `Failed to send email: ${error.message}`,
            );
        }
    }
}
