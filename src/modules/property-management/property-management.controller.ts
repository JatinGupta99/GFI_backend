import { Controller, Get, Post, Query, Param, Body, ParseIntPipe, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PropertyManagementService } from './property-management.service';
import { ARBalance, ARBalanceResponse, NoticeType, SendNoticeDto } from './dto/ar-balance.dto';

@ApiTags('Property Management')
@Controller('property-management')
export class PropertyManagementController {
    constructor(private readonly propertyManagementService: PropertyManagementService) { }

    @Get('ar-balances')
    @ApiOperation({ summary: 'Get all tenant AR balances' })
    @ApiResponse({ status: 200, type: [ARBalance] })
    async getAllBalances(): Promise<ARBalance[]> {
        return this.propertyManagementService.getAllARBalances();
    }

    @Get('ar-tenants')
    @ApiOperation({ summary: 'Get largest AR balances for dashboard' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, type: ARBalanceResponse })
    async getLargestBalances(@Query('limit', new ParseIntPipe({ optional: true })) limit = 10): Promise<ARBalanceResponse> {
        const data = await this.propertyManagementService.getARTenants(limit);
        return { data };
    }

    @Get('dashboard-stats')
    @ApiOperation({ summary: 'Get aggregated summary stats for dashboard header' })
    @ApiResponse({ status: 200 })
    async getDashboardStats() {
        return this.propertyManagementService.getDashboardStats();
    }

    @Post('ar-balances/:tenantId/notices/:type')
    @ApiOperation({ summary: 'Trigger notice workflow for a tenant' })
    @ApiResponse({ status: 200 })
    @UsePipes(new ValidationPipe({ transform: true }))
    async sendNotice(
        @Param('tenantId') tenantId: string,
        @Param('type') type: NoticeType,
        @Body() body: SendNoticeDto
    ) {
        return this.propertyManagementService.sendNotice(tenantId, type, body);
    }
}
