import { Controller, Get, Param, UseInterceptors, Query } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { RentRollService } from './rent-roll.service';
import { RentRollRow } from './dto/rent-roll-row.dto';

@Controller('rent-roll')
@UseInterceptors(CacheInterceptor)
export class RentRollController {
    constructor(private readonly rentRollService: RentRollService) { }

    @Get(':propertyId')
    // @CacheTTL(15 * 60 * 1000) // TTL in milliseconds for Cache Manager v5+
    async getRentRoll(
        @Param('propertyId') propertyId: string,
        @Query('page') page?: number,
        @Query('size') size?: number
    ): Promise<RentRollRow[]> {
        // Note: Pagination logic is currently stubbed as the requirement focuses on the structure.
        // In a real implementation, we would splice the results array here or pass params to the service.

        return this.rentRollService.getRentRoll(propertyId);
    }
}
