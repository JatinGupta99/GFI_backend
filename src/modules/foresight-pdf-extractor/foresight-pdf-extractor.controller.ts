import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ForeSightPdfExtractorService } from './foresight-pdf-extractor.service';
import { ExtractionResultDto } from './dto/extraction-result.dto';
import { ExcelParserUtil } from './utils/excel-parser.util';
import { Public } from '../../common/decorators/public.decorator';
import { PropertiesService } from '../properties/properties.service';
import { SuitesService } from '../suites/suites.service';

@ApiTags('foresight-pdf-extractor')
@Controller('foresight-pdf-extractor')
@Public()
export class ForeSightPdfExtractorController {
  private readonly logger = new Logger(ForeSightPdfExtractorController.name);

  constructor(
    private readonly foreSightPdfExtractorService: ForeSightPdfExtractorService,
    private readonly propertiesService: PropertiesService,
    private readonly suitesService: SuitesService,
  ) {}

  @Post('extract')
  @ApiOperation({
    summary: 'Extract financial data from ForeSight PDF or Excel file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF or Excel file (.pdf, .xlsx, .xls)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File extracted successfully',
    type: ExtractionResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format',
  })
  @ApiResponse({
    status: 500,
    description: 'File parsing error',
  })
  @UseInterceptors(FileInterceptor('file'))
  async extractPdf(@UploadedFile() file: any): Promise<ExtractionResultDto> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file mimetype (accept both PDF and Excel)
    const validMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file format. Expected PDF or Excel file',
      );
    }

    try {
      let result: ExtractionResultDto;

      // Route to appropriate parser based on file type
      if (file.mimetype === 'application/pdf') {
        // Call PDF service to extract financial data
        result =
          await this.foreSightPdfExtractorService.extractFinancialData(
            file.buffer,
          );
      } else {
        // Call Excel parser to extract financial data
        result = ExcelParserUtil.extractFinancialData(file.buffer);
      }

      // Save extracted data to database
      try {
        this.logger.log(
          `Saving extracted data for property ${result.propertyId}`,
        );

        // Save property data
        await this.propertiesService.saveForeSightProperty(
          result.propertyId,
          result.propertyName,
          result.region,
        );

        // Save suites data
        await this.suitesService.saveForeSightSuites(
          result.propertyId,
          result.suites,
        );

        this.logger.log(
          `Successfully saved data for property ${result.propertyId} with ${result.suites.length} suites`,
        );
      } catch (dbError) {
        this.logger.error(
          `Failed to save data to database: ${dbError.message}`,
          dbError.stack,
        );
        // Continue and return the extraction result even if DB save fails
        // You can choose to throw an error here if DB save is critical
      }

      return result;
    } catch (error) {
      // Handle parsing errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Failed to extract data: ${errorMessage}`,
      );
    }
  }
}
