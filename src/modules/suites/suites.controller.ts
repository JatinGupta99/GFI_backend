import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SuitesService } from './suites.service';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';
import { BudgetUploadDto, BudgetUploadResponseDto } from './dto/budget-upload.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('suites')
@Controller('suites')
@Public()
export class SuitesController {
  constructor(private readonly suitesService: SuitesService) {}

  @Post('upload-budget')
  @ApiOperation({
    summary: 'Upload budget file (PDF/Excel) to extract and update suite data',
    description: 'Processes budget files to calculate TI/SF, Base Rent/SF, and update suite financial data',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Budget file (.pdf, .xlsx, .xls)',
        },
        propertyId: {
          type: 'string',
          description: 'Optional property ID (will be extracted from file if not provided)',
          example: '006564',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the upload',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Budget file processed successfully',
    type: BudgetUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or processing error',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadBudgetFile(
    @UploadedFile() file: any,
    @Body() uploadDto: BudgetUploadDto,
  ): Promise<BudgetUploadResponseDto> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const validMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file format. Expected PDF or Excel file (.pdf, .xlsx, .xls)',
      );
    }

    try {
      // Process the budget file
      const result = await this.suitesService.processBudgetFile(
        file.buffer,
        file.originalname,
        uploadDto.propertyId,
      );

      return result;
    } catch (error) {
      throw new BadRequestException(
        `Failed to process budget file: ${error.message}`,
      );
    }
  }

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
