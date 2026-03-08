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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RenewalQueryService } from './services/renewal-query.service';
import { RenewalSyncService } from './services/renewal-sync.service';
import { RenewalFilters } from './interfaces/renewal-provider.interface';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { UpdateRenewalNotesDto } from './dto/update-renewal-notes.dto';
import { RenewalDetailMapper } from './mappers/renewal-detail.mapper';

@ApiTags('Renewals')
@Controller('renewals')
export class RenewalsController {
  private readonly logger = new Logger(RenewalsController.name);

  constructor(
    private readonly queryService: RenewalQueryService,
    private readonly syncService: RenewalSyncService,
  ) {}

  /**
   * Get all renewals with optional filters
   * Fast endpoint - returns from database/cache
   */
  @Get()
  @ApiOperation({ summary: 'Get renewals with optional filters' })
  @ApiQuery({ name: 'propertyIds', required: false, type: [String] })
  @ApiQuery({ name: 'status', required: false, type: [String] })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Renewals retrieved successfully' })
  async getRenewals(
    @Query('propertyIds') propertyIds?: string | string[],
    @Query('status') status?: string | string[],
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const filters: RenewalFilters = {};

    if (propertyIds) {
      filters.propertyIds = Array.isArray(propertyIds) ? propertyIds : [propertyIds];
    }

    if (status) {
      filters.status = Array.isArray(status) ? status : [status];
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
  @ApiResponse({ status: 200, description: 'AR balances retrieved successfully' })
  async getARBalancesByProperty(
    @Query('propertyIds') propertyIds?: string | string[],
  ) {
    const filters: RenewalFilters = {};

    if (propertyIds) {
      filters.propertyIds = Array.isArray(propertyIds) ? propertyIds : [propertyIds];
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
      const balance = renewal.currentRent || 0;
      
      acc[propertyId].totalBalance += balance;
      acc[propertyId].tenantCount += 1;
      acc[propertyId].tenants.push({
        tenantId: renewal.tenantId,
        tenantName: renewal.tenantName,
        unit: renewal.unit,
        balance: balance,
        currentRent: renewal.currentRent,
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
   * Search renewals by tenant name, property name, or unit
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
   * Trigger full sync of all properties
   * Background job - returns immediately with job ID
   */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger full renewal sync for all properties' })
  @ApiResponse({ status: 202, description: 'Sync job queued successfully' })
  async syncAllRenewals() {
    const result = await this.syncService.syncAllProperties();

    return {
      success: true,
      message: 'Full renewal sync job queued successfully',
      data: result,
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

    const result = await this.syncService.syncProperty(propertyId);

    return {
      success: result.success,
      message: result.success 
        ? 'Property sync completed successfully' 
        : 'Property sync completed with errors',
      data: result,
    };
  }

  /**
   * Trigger incremental sync (only changed data since last sync)
   * Background job - returns immediately with job ID
   */
  @Post('sync/incremental')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger incremental renewal sync' })
  @ApiResponse({ status: 202, description: 'Incremental sync job queued successfully' })
  async syncIncremental() {
    const result = await this.syncService.syncIncremental();

    return {
      success: true,
      message: 'Incremental renewal sync job queued successfully',
      data: result,
    };
  }

  /**
   * Get sync job status
   */
  @Get('sync/status/:jobId')
  @ApiOperation({ summary: 'Get sync job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved successfully' })
  async getSyncStatus(@Param('jobId') jobId: string) {
    const status = await this.syncService.getJobStatus(jobId);

    return {
      success: true,
      data: status,
    };
  }

  /**
   * Clear sync queue
   */
  @Post('sync/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all pending sync jobs' })
  @ApiResponse({ status: 200, description: 'Sync queue cleared successfully' })
  async clearSyncQueue() {
    const result = await this.syncService.clearQueue();

    return {
      success: true,
      message: 'Sync queue cleared successfully',
      data: result,
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
}