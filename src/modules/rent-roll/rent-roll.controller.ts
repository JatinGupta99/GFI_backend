import { Controller, Get, Param, UseInterceptors, Query } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { RentRollService } from './rent-roll.service';
import { RentRollRow } from './dto/rent-roll-row.dto';

@Controller('rent-roll')
@UseInterceptors(CacheInterceptor)
export class RentRollController {
    constructor(private readonly rentRollService: RentRollService) { }

    @Get(':propertyId')
    async getRentRoll(
        @Param('propertyId') propertyId: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number
    ): Promise<{ data: RentRollRow[], total: number }> {
        return this.rentRollService.getRentRoll(propertyId, page, limit);
    }

    @Get(':propertyId/upcoming-renewals')
    async getUpcomingRenewals(
        @Param('propertyId') propertyId: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Query('search') search?: string,
        @Query('status') status?: string
    ): Promise<{ data: RentRollRow[], total: number }> {
        return this.rentRollService.getUpcomingRenewals(propertyId, page, limit, search, status);
    }
}
