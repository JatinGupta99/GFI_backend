import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SuitesService } from './suites.service';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('suites')
@Controller('suites')
@Public()
export class SuitesController {
  constructor(private readonly suitesService: SuitesService) {}

  @Post()
  create(@Body() createSuiteDto: CreateSuiteDto) {
    return this.suitesService.create(createSuiteDto);
  }

  @Get()
  findAll() {
    return this.suitesService.findAll();
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get all suites for a property' })
  @ApiParam({ name: 'propertyId', description: 'Property ID', example: '006565' })
  @ApiResponse({ status: 200, description: 'Returns all suites for the property' })
  @ApiResponse({ status: 404, description: 'No suites found for this property' })
  async getSuitesByProperty(@Param('propertyId') propertyId: string) {
    const suites = await this.suitesService.findByPropertyId(propertyId);
    
    if (!suites || suites.length === 0) {
      throw new NotFoundException(`No suites found for property ${propertyId}`);
    }
    
    return {
      status: 'success',
      message: 'Suites retrieved successfully',
      data: {
        propertyId,
        totalSuites: suites.length,
        suites,
      },
    };
  }

  @Get('property/:propertyId/suite/:suiteId')
  @ApiOperation({ summary: 'Get a specific suite by propertyId and suiteId' })
  @ApiParam({ name: 'propertyId', description: 'Property ID', example: '006565' })
  @ApiParam({ name: 'suiteId', description: 'Suite ID', example: '113' })
  @ApiResponse({ status: 200, description: 'Returns the suite details' })
  @ApiResponse({ status: 404, description: 'Suite not found' })
  async getSuiteByPropertyAndSuiteId(
    @Param('propertyId') propertyId: string,
    @Param('suiteId') suiteId: string,
  ) {
    const suite = await this.suitesService.findBySuiteId(propertyId, suiteId);
    
    if (!suite) {
      throw new NotFoundException(
        `Suite ${suiteId} not found for property ${propertyId}`,
      );
    }
    
    return {
      status: 'success',
      message: 'Suite retrieved successfully',
      data: suite,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suitesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSuiteDto: UpdateSuiteDto) {
    return this.suitesService.update(+id, updateSuiteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.suitesService.remove(+id);
  }
}
