import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { LeasingService } from './leasing.service';
import { GetRenewalsQueryDto } from './dto/get-renewals-query.dto';

@Controller('leasing/renewals')
@UseInterceptors(CacheInterceptor)
export class LeasingController {
    constructor(private readonly service: LeasingService) { }

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

    @Get('/all')
    async getAllUpcomingRenewals() {
        const data = await this.service.getAllUpcomingRenewals();
        return {
            data,
            meta: {
                total: data.length,
            }
        };
    }
}
