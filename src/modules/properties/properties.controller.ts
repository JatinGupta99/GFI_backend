import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AggregatedStatsDto } from './dto/aggregated-stats.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyStatsDto } from './dto/property-stats.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) { }

  @Post()
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
  }

  @Get()
  findAll() {
    return this.propertiesService.findAll();
  }

  @Get('stats/aggregated')
  @ApiOperation({ 
    summary: 'Get aggregated statistics across all properties',
    description: 'Returns count, total SF, and property count for vacant spaces, LOI negotiation, lease negotiation, and renewals. Optionally filter by property IDs.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Aggregated statistics retrieved successfully',
    type: AggregatedStatsDto
  })
  getAggregatedStats(@Query('propertyIds') propertyIds?: string): Promise<AggregatedStatsDto> {
    // Parse comma-separated property IDs if provided
    const propertyIdArray = propertyIds ? propertyIds.split(',').map(id => id.trim()) : undefined;
    return this.propertiesService.getAggregatedStats(propertyIdArray);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, updatePropertyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertiesService.remove(id);
  }

  @Get(':id/vacant-suites')
  getVacantSuites(@Param('id') id: string, @Query('afterDate') afterDate?: string) {
    return this.propertiesService.getVacantSuites(id, afterDate);
  }

  @Get(':id/stats')
  @ApiOperation({ 
    summary: 'Get property statistics',
    description: 'Returns square footage statistics for vacant spaces, LOI negotiation, lease negotiation, and renewals'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Property statistics retrieved successfully',
    type: PropertyStatsDto
  })
  getPropertyStats(@Param('id') id: string): Promise<PropertyStatsDto> {
    return this.propertiesService.getPropertyStats(id);
  }
}

