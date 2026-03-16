import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RenewalQueryService } from './services/renewal-query.service';
import { RenewalSyncService } from './services/renewal-sync.service';
import { LeasingService } from '../leasing/leasing.service';
import { RenewalFilters } from './interfaces/renewal-provider.interface';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { UpdateRenewalNotesDto } from './dto/update-renewal-notes.dto';
import { UpdateRenewalStatusDto } from './dto/update-renewal-status.dto';
import { RenewalDetailMapper } from './mappers/renewal-detail.mapper';
import { RenewalStatus } from '../../common/enums/common-enums';

@ApiTags('Renewals')
@Controller('renewals')
export class RenewalsController {
  private readonly logger = new Logger(RenewalsController.name);

  constructor(
    private readonly queryService: RenewalQueryService,
    private readonly syncService: RenewalSyncService,
    @Inject(forwardRef(() => LeasingService))
    private readonly leasingService: LeasingService,
  ) {}

  /**
   * Get all renewals with optional filters
   * Fast endpoint - returns from database/cache
   */
  @Get()
  @ApiOperation({ summary: 'Get renewals with optional filters' })
  @ApiQuery({ name: 'propertyIds', required: false, type: [String] })
  @ApiQuery({ name: 'property', required: false, type: String, description: 'Single property ID (alternative to propertyIds)' })
  @ApiQuery({ name: 'status', required: false, type: [String] })
  @ApiQuery({ name: 'renewal_status', required: false, enum: RenewalStatus, description: 'Filter by renewal status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Renewals retrieved successfully' })
  async getRenewals(
    @Query('propertyIds') propertyIds?: string | string[],
    @Query('property') property?: string,
    @Query('status') status?: string | string[],
    @Query('renewal_status') renewalStatus?: RenewalStatus | string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const filters: RenewalFilters = {};

    // Handle both propertyIds and property parameters for backward compatibility
    if (propertyIds) {
      // Handle comma-separated string or array
      if (Array.isArray(propertyIds)) {
        filters.propertyIds = propertyIds;
      } else {
        // Split comma-separated string and trim whitespace
        filters.propertyIds = propertyIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      }
    } else if (property) {
      filters.propertyIds = [property];
    }

    // Define status groups
    const STATUS_GROUPS = {
      ALL_NOTICES: [
        RenewalStatus.SEND_ATTORNEY_NOTICE,
        RenewalStatus.SEND_COURTESY_NOTICE,
        RenewalStatus.SEND_THREE_DAY_NOTICE,
      ],
    };

    // Handle status filtering with groups
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      
      // Check if any status is a group
      let expandedStatuses: string[] = [];
      for (const s of statusArray) {
        if (s === 'ALL_NOTICES' && STATUS_GROUPS.ALL_NOTICES) {
          expandedStatuses.push(...STATUS_GROUPS.ALL_NOTICES);
        } else {
          expandedStatuses.push(s);
        }
      }
      
      filters.status = expandedStatuses;
    } else if (renewalStatus) {
      // Handle renewal_status parameter
      if (renewalStatus === 'ALL_NOTICES') {
        filters.status = STATUS_GROUPS.ALL_NOTICES;
      } else {
        filters.status = [renewalStatus];
      }
    }

    // Default values
    const limitValue = limit ? Number(limit) : 20;
    
    // Support both page-based and offset-based pagination
    // If page is provided, convert to offset; otherwise use offset directly
    let offsetValue: number;
    let pageValue: number;
    
    if (page !== undefined) {
      // Page-based pagination (page is 1-indexed)
      pageValue = Math.max(1, Number(page));
      offsetValue = (pageValue - 1) * limitValue;
    } else if (offset !== undefined) {
      // Offset-based pagination
      offsetValue = Number(offset);
      pageValue = Math.floor(offsetValue / limitValue) + 1;
    } else {
      // Default to first page
      offsetValue = 0;
      pageValue = 1;
    }
    
    filters.limit = limitValue;
    filters.offset = offsetValue;

    const result = await this.queryService.getRenewals(filters);

    return {
      success: true,
      data: result.data,
      meta: PaginationHelper.buildMeta({
        total: result.total,
        page: pageValue,
        limit: limitValue,
        offset: offsetValue,
        cached: result.cached,
      }),
    };
  }

  /**
   * Get AR Balances by Property
   * Returns accounts receivable balances grouped by property
   */
  @Get('ar-balances/by-property')
  @ApiOperation({ summary: 'Get AR balances by property' })
  @ApiQuery({ name: 'propertyIds', required: false, type: [String] })
  @ApiQuery({ name: 'property', required: false, type: String, description: 'Single property ID (alternative to propertyIds)' })
  @ApiResponse({ status: 200, description: 'AR balances retrieved successfully' })
  async getARBalancesByProperty(
    @Query('propertyIds') propertyIds?: string | string[],
    @Query('property') property?: string,
  ) {
    const filters: RenewalFilters = {};

    // Handle both propertyIds and property parameters for backward compatibility
    if (propertyIds) {
      // Handle comma-separated string or array
      if (Array.isArray(propertyIds)) {
        filters.propertyIds = propertyIds;
      } else {
        // Split comma-separated string and trim whitespace
        filters.propertyIds = propertyIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      }
    } else if (property) {
      filters.propertyIds = [property];
    }

    const renewals = await this.queryService.getRenewals(filters);

    // Group renewals by property and calculate AR balances
    const arBalancesByProperty = renewals.data.reduce((acc, renewal: any) => {
      const propertyId = renewal.propertyId;
      
      if (!acc[propertyId]) {
        acc[propertyId] = {
          propertyId,
          propertyName: renewal.propertyName,
          totalBalance: 0,
          tenantCount: 0,
          tenants: [],
        };
      }

      // Calculate balance (this is a placeholder - adjust based on your actual AR calculation)
      const balance = renewal.currentMonthRent || 0;
      
      acc[propertyId].totalBalance += balance;
      acc[propertyId].tenantCount += 1;
      acc[propertyId].tenants.push({
        tenantId: renewal.tenantId,
        tenantName: renewal.tenantName,
        suite: renewal.suite,
        balance: balance,
        currentMonthRent: renewal.currentMonthRent,
        status: renewal.status,
      });

      return acc;
    }, {});

    const result = Object.values(arBalancesByProperty);

    return {
      status: 'success',
      message: 'Request completed successfully',
      data: result,
      meta: {
        totalProperties: result.length,
        cached: renewals.cached,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get AR Balances Summary by Property
   * Returns simplified AR balances grouped by property with total AR balance from renewal schema
   */
  @Get('ar-balances/summary')
  @ApiOperation({ summary: 'Get AR balances summary by property' })
  @ApiQuery({ name: 'propertyIds', required: false, type: [String], description: 'Array of property IDs to filter' })
  @ApiResponse({ status: 200, description: 'AR balances summary retrieved successfully' })
  async getARBalancesSummary(
    @Query('propertyIds') propertyIds?: string | string[],
  ) {
    const filters: RenewalFilters = {};

    // Handle propertyIds parameter
    if (propertyIds) {
      // Handle comma-separated string or array
      if (Array.isArray(propertyIds)) {
        filters.propertyIds = propertyIds;
      } else {
        // Split comma-separated string and trim whitespace
        filters.propertyIds = propertyIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      }
    }

    const renewals = await this.queryService.getRenewals(filters);

    // Group renewals by property and calculate total AR balances
    const arBalancesByProperty = renewals.data.reduce((acc, renewal: any) => {
      const propertyId = renewal.propertyId;
      const propertyName = renewal.propertyName;
      
      if (!acc[propertyId]) {
        acc[propertyId] = {
          propertyName: propertyName,
          totalArBalance: 0,
        };
      }

      // Calculate AR balance from renewal schema fields
      const arBalance = (renewal.totalArBalance || 0);
      
      acc[propertyId].totalArBalance += arBalance;

      return acc;
    }, {});

    // Convert to array format as requested: [{propertyName:"", totalArBalance:""}]
    const result = Object.values(arBalancesByProperty);

    return {
      success: true,
      data: result,
      meta: {
        totalProperties: result.length,
        cached: renewals.cached,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get a single renewal by ID
   * Fast endpoint - returns from database/cache
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get renewal by ID' })
  @ApiResponse({ status: 200, description: 'Renewal retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Renewal not found' })
  async getRenewalById(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Renewal ID is required');
    }

    const result = await this.queryService.getRenewalById(id);

    if (!result.data) {
      throw new NotFoundException(`Renewal with ID ${id} not found`);
    }

    // Map the renewal data to detailed DTO
    const mappedData = RenewalDetailMapper.toDetailDto(result.data);

    return {
      status: 'success',
      message: 'Request completed successfully',
      data: mappedData,
      meta: {
        cached: result.cached,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get renewals for a specific property
   * Fast endpoint - returns from database/cache
   */
  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get renewals for a specific property' })
  @ApiResponse({ status: 200, description: 'Property renewals retrieved successfully' })
  async getRenewalsByProperty(@Param('propertyId') propertyId: string) {
    if (!propertyId) {
      throw new BadRequestException('Property ID is required');
    }

    const result = await this.queryService.getRenewalsByProperty(propertyId);

    return {
      success: true,
      data: result.data,
      meta: {
        propertyId,
        total: result.data.length,
        cached: result.cached,
      },
    };
  }

  /**
   * Get upcoming renewals (next 90 days by default)
   * Fast endpoint - returns from database/cache
   */
  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming renewals' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Days ahead to look for renewals (default: 90)' })
  @ApiResponse({ status: 200, description: 'Upcoming renewals retrieved successfully' })
  async getUpcomingRenewals(@Query('days') days?: number) {
    const daysAhead = days ? Number(days) : 90;
    const result = await this.queryService.getUpcomingRenewals(daysAhead);

    return {
      success: true,
      data: result.data,
      meta: {
        daysAhead,
        total: result.data.length,
        cached: result.cached,
      },
    };
  }

  /**
   * Get renewal statistics
   * Fast endpoint - returns from database/cache
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get renewal statistics' })
  @ApiResponse({ status: 200, description: 'Renewal statistics retrieved successfully' })
  async getRenewalStats() {
    const stats = await this.queryService.getRenewalStats();

    return {
      success: true,
      data: stats,
      meta: {
        cached: stats.cached,
      },
    };
  }

  /**
   * Search renewals by tenant name, property name, or suite
   * Fast endpoint - returns from database/cache
   */
  @Get('search')
  @ApiOperation({ summary: 'Search renewals' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search term' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results (default: 50)' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchRenewals(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
  ) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters');
    }

    const result = await this.queryService.searchRenewals(
      searchTerm.trim(),
      limit ? Number(limit) : 50,
    );

    return {
      success: true,
      data: result.data,
      meta: {
        searchTerm,
        total: result.data.length,
        cached: result.cached,
      },
    };
  }

  /**
   * Trigger manual sync for all renewals or specific property
   * Synchronous - returns when complete
   */
  @Public()
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual renewal sync' })
  @ApiQuery({ name: 'propertyId', required: false, type: String, description: 'Optional property ID to sync specific property' })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  async triggerManualSync(@Query('propertyId') propertyId?: string) {
    // Use leasing service for sync to fetch fresh data from MRI
    const result = await this.leasingService.queueRenewalsSync({
      propertyIds: propertyId ? [propertyId] : undefined,
      delayBetweenJobs: 300000, // 2 seconds between jobs
      clearCache: true,
    });

    return {
      success: true,
      message: propertyId 
        ? `Sync queued for property ${propertyId}` 
        : 'Sync queued for all properties',
      data: {
        batchId: result.batchId,
        jobIds: result.jobIds,
        totalProperties: result.totalProperties,
        statusUrl: `/leasing/renewals/batch/${result.batchId}`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Trigger sync for a specific property
   * Synchronous - returns when complete
   */
  @Post('sync/property/:propertyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync renewals for a specific property' })
  @ApiResponse({ status: 200, description: 'Property sync completed successfully' })
  async syncProperty(@Param('propertyId') propertyId: string) {
    if (!propertyId) {
      throw new BadRequestException('Property ID is required');
    }

    // Use leasing service for sync to fetch fresh data from MRI
    const result = await this.leasingService.queueRenewalsSync({
      propertyIds: [propertyId],
      delayBetweenJobs: 0, // No delay for single property
      clearCache: true,
    });

    return {
      success: true,
      message: `Sync queued for property ${propertyId}`,
      data: {
        batchId: result.batchId,
        jobIds: result.jobIds,
        totalProperties: result.totalProperties,
        statusUrl: `/leasing/renewals/batch/${result.batchId}`,
      },
      timestamp: new Date().toISOString(),
    };
  }
  /**
   * Clear renewal cache
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear renewal cache' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    await this.queryService.clearCache();

    return {
      success: true,
      message: 'Renewal cache cleared successfully',
    };
  }

  /**
   * Update renewal notes
   */
  @Patch(':id/notes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notes for a renewal' })
  @ApiBody({ type: UpdateRenewalNotesDto })
  @ApiResponse({ status: 200, description: 'Notes updated successfully' })
  @ApiResponse({ status: 404, description: 'Renewal not found' })
  async updateRenewalNotes(
    @Param('id') id: string,
    @Body() dto: UpdateRenewalNotesDto,
  ) {
    if (!id) {
      throw new BadRequestException('Renewal ID is required');
    }

    const result = await this.queryService.updateRenewalNotes(id, dto.notes || '');

    if (!result.success) {
      throw new NotFoundException(`Renewal with ID ${id} not found`);
    }

    return {
      success: true,
      message: 'Notes updated successfully',
      data: result.data,
    };
  }

  /**
   * Update renewal status
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update status for a renewal' })
  @ApiBody({ type: UpdateRenewalStatusDto })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 404, description: 'Renewal not found' })
  async updateRenewalStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRenewalStatusDto,
  ) {
    if (!id) {
      throw new BadRequestException('Renewal ID is required');
    }

    const result = await this.queryService.updateRenewalStatus(id, dto.status);

    if (!result.success) {
      throw new NotFoundException(`Renewal with ID ${id} not found`);
    }

    return {
      success: true,
      message: 'Status updated successfully',
      data: result.data,
    };
  }


  /**
   * Get presigned S3 upload URL for renewal file
   */
  @Post(':id/files/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get presigned S3 upload URL for renewal file' })
  @ApiResponse({ status: 200, description: 'Upload URL generated successfully' })
  @ApiResponse({ status: 404, description: 'Renewal not found' })
  async getFileUploadUrl(
    @Param('id') id: string,
    @Body('contentType') contentType: string,
    @Body('category') category: string,
  ) {
    if (!id) {
      throw new BadRequestException('Renewal ID is required');
    }

    if (!contentType) {
      throw new BadRequestException('Content type is required');
    }

    return this.queryService.getFileUploadUrl(id, contentType, category);
  }

  /**
   * Confirm file upload and save file metadata
   */
  @Post(':id/files/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm file upload and save metadata' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  @ApiResponse({ status: 404, description: 'Renewal not found' })
  async confirmFileUpload(
    @Param('id') id: string,
    @Body('key') key: string,
    @Body('fileName') fileName: string,
    @Body('fileSize') fileSize: number,
    @Body('fileType') fileType: string,
    @Body('category') category: string,
  ) {
    if (!id) {
      throw new BadRequestException('Renewal ID is required');
    }

    if (!key || !fileName) {
      throw new BadRequestException('File key and name are required');
    }

    return this.queryService.confirmFileUpload(
      id,
      key,
      fileName,
      fileSize,
      fileType,
      category,
      'System', // TODO: Get user name from auth context
    );
  }

}