import { Controller, Get, Post, Query, Param, UseInterceptors, Body, HttpCode, HttpStatus, Req, NotFoundException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { HttpCacheInterceptor } from '../../common/cache/app-cache.module';
import { LeasingService } from './leasing.service';
import { GetRenewalsQueryDto } from './dto/get-renewals-query.dto';
import { SendExecutionEmailDto } from './dto/send-execution-email.dto';
import { AddRenewalNoteDto } from './dto/add-renewal-note.dto';
import { LeaseEmailService } from './services/lease-email.service';

@Controller('leasing')
@UseInterceptors(HttpCacheInterceptor)
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
    @CacheTTL(1800) // Cache for 30 minutes
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
    @CacheTTL(600) // Cache for 10 minutes
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
     * Add a note to a commercial lease for upcoming renewal
     * POST /leasing/renewals/:buildingId/:leaseId/notes
     */
    @Post('renewals/:buildingId/:leaseId/notes')
    @HttpCode(HttpStatus.CREATED)
    async addRenewalNote(
        @Param('buildingId') buildingId: string,
        @Param('leaseId') leaseId: string,
        @Body() dto: AddRenewalNoteDto
    ) {
        const note = await this.service.addRenewalNote(
            buildingId,
            leaseId,
            dto.noteText,
            dto.noteReference1,
            dto.noteReference2
        );

        return {
            success: true,
            message: 'Renewal note added successfully',
            data: note,
        };
    }

    /**
     * Get all notes for a commercial lease
     * GET /leasing/renewals/:buildingId/:leaseId/notes
     */
    @Get('renewals/:buildingId/:leaseId/notes')
    @CacheTTL(180) // Cache for 3 minutes
    async getRenewalNotes(
        @Param('buildingId') buildingId: string,
        @Param('leaseId') leaseId: string
    ) {
        const notes = await this.service.getRenewalNotes(buildingId, leaseId);

        return {
            data: notes,
            meta: {
                total: notes.length,
                buildingId,
                leaseId,
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
    @CacheTTL(300) // Cache for 5 minutes
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
