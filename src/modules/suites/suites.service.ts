import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CreateSuiteDto } from './dto/create-suite.dto';
import { UpdateSuiteDto } from './dto/update-suite.dto';
import { SuiteRepository } from './repository/suite.repository';
import { SuiteDataDto } from '../foresight-pdf-extractor/dto/suite-data.dto';
import { BudgetExcelParserUtil, BudgetSuiteData, ExcelSuiteData, ExcelExtractionResult } from '../foresight-pdf-extractor/utils/budget-excel-parser.util';
import { BudgetUploadResponseDto, BudgetSuiteUpdateDto } from './dto/budget-upload.dto';
import { ForeSightPdfExtractorService } from '../foresight-pdf-extractor/foresight-pdf-extractor.service';

@Injectable()
export class SuitesService {
  private readonly logger = new Logger(SuitesService.name);

  constructor(
    private readonly suiteRepository: SuiteRepository,
    @Inject(forwardRef(() => ForeSightPdfExtractorService))
    private readonly foreSightPdfExtractorService: ForeSightPdfExtractorService,
  ) {}

  create(createSuiteDto: CreateSuiteDto) {
    return 'This action adds a new suite';
  }

  findAll() {
    return `This action returns all suites`;
  }

  findOne(id: number) {
    return `This action returns a #${id} suite`;
  }

  update(id: number, updateSuiteDto: UpdateSuiteDto) {
    return `This action updates a #${id} suite`;
  }

  remove(id: number) {
    return `This action removes a #${id} suite`;
  }

  /**
   * Process budget file upload and update suites with calculated TI/SF and Base Rent/SF
   */
  async processBudgetFile(
    fileBuffer: Buffer,
    fileName: string,
    propertyId?: string,
  ): Promise<BudgetUploadResponseDto> {
    this.logger.log(`Processing budget file: ${fileName}`);

    // VERY OBVIOUS DEBUG MARKER - THIS SHOULD APPEAR IN LOGS
    this.logger.log('NEW SERVICE CODE IS RUNNING');
    this.logger.log('ENHANCED PARSER SHOULD BE USED');

    try {
      // Try enhanced extraction first
      this.logger.log('Attempting enhanced extraction...');
      const enhancedResult = BudgetExcelParserUtil.extractEnhancedBudgetData(fileBuffer);
      
      this.logger.log(`Enhanced extraction result: success=${enhancedResult.success}, suitesCount=${enhancedResult.suites.length}, errorsCount=${enhancedResult.errors.length}`);
      
      if (enhancedResult.success && enhancedResult.suites.length > 0) {
        this.logger.log(`Enhanced extraction: ${enhancedResult.suites.length} suites found`);
        this.logger.log('Using enhanced extraction');
        return await this.processEnhancedBudgetData(enhancedResult, propertyId);
      }

      // Fallback to original extraction
      this.logger.log('Enhanced extraction failed, falling back to original method');
      this.logger.log('Enhanced extraction failed, falling back to original method');
      const extractionResult = BudgetExcelParserUtil.extractBudgetData(fileBuffer);
      // Use provided propertyId or extracted one
      const finalPropertyId = propertyId || extractionResult.propertyId;
      
      this.logger.log(`Extracted ${extractionResult.suites.length} suites from budget file`);

      // Convert budget data to suite update format
      const suiteUpdates: BudgetSuiteUpdateDto[] = extractionResult.suites.map(suite => 
        this.convertBudgetSuiteToUpdate(suite, finalPropertyId)
      );

      // Update suites in database
      await this.updateSuitesFromBudget(finalPropertyId, suiteUpdates);

      return {
        success: true,
        message: `Successfully processed budget file and updated ${suiteUpdates.length} suites`,
        propertyId: finalPropertyId,
        suitesProcessed: suiteUpdates.length,
        extractionLogs: extractionResult.extractionLogs,
        suites: suiteUpdates,
      };

    } catch (error) {
      this.logger.error(`Failed to process budget file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Convert BudgetSuiteData to BudgetSuiteUpdateDto format
   */
  private convertBudgetSuiteToUpdate(
    budgetSuite: BudgetSuiteData,
    propertyId: string,
  ): BudgetSuiteUpdateDto {
    return {
      suiteId: budgetSuite.suiteId,
      propertyId,
      squareFootage: budgetSuite.squareFootage,
      tiPerSf: this.formatDecimalToString(budgetSuite.tiPerSf),
      baseRentPerSf: this.formatDecimalToString(budgetSuite.baseRentPerSf),
      camPerSf: this.formatDecimalToString(budgetSuite.camPerSf),
      insPerSf: this.formatDecimalToString(budgetSuite.insPerSf),
      taxPerSf: this.formatDecimalToString(budgetSuite.taxPerSf),
      rcd: null,
      charges: {
        baseRentMonth: budgetSuite.proposedValues.baseRent.toString(),
        camMonth: budgetSuite.proposedValues.cam.toString(),
        insMonth: budgetSuite.proposedValues.insurance.toString(),
        taxMonth: budgetSuite.proposedValues.tax.toString(),
        totalDueMonth: (
          budgetSuite.proposedValues.baseRent +
          budgetSuite.proposedValues.cam +
          budgetSuite.proposedValues.insurance +
          budgetSuite.proposedValues.tax
        ).toString(),
      },
      balanceDue: 0, // Default value, can be calculated if needed
      leaseTerms: {
        rentDueDate: null,
        lateAfter: null,
        lateFee: 0,
      },
      monthlyPayments: budgetSuite.monthlyPayments,
      status: 'Vacant', // Default status
    };
  }

  /**
   * Process enhanced budget data from new extraction method
   */
  private async processEnhancedBudgetData(
    extractionResult: ExcelExtractionResult,
    propertyId?: string,
  ): Promise<BudgetUploadResponseDto> {
    this.logger.log('Processing enhanced budget data...');
    
    // Use provided propertyId or extract from first suite
    const finalPropertyId = propertyId || extractionResult.suites[0]?.propertyId || 'UNKNOWN';
    
    this.logger.log(`Final property ID: ${finalPropertyId}`);
    
    // Convert enhanced data to suite update format
    const suiteUpdates: BudgetSuiteUpdateDto[] = extractionResult.suites.map(suite => 
      this.convertEnhancedSuiteToUpdate(suite)
    );

    // Update suites in database
    await this.updateSuitesFromBudget(finalPropertyId, suiteUpdates);

    return {
      success: true,
      message: `Successfully processed budget file and updated ${suiteUpdates.length} suites`,
      propertyId: finalPropertyId,
      suitesProcessed: suiteUpdates.length,
      extractionLogs: extractionResult.extractionLogs,
      suites: suiteUpdates,
    };
  }

  /**
   * Convert ExcelSuiteData to BudgetSuiteUpdateDto format
   */
  private convertEnhancedSuiteToUpdate(suite: ExcelSuiteData): BudgetSuiteUpdateDto {
    const squareFootage = typeof suite.squareFootage === 'string' ? parseFloat(suite.squareFootage) : suite.squareFootage;
    const camMonth = typeof suite.camMonth === 'string' ? parseFloat(suite.camMonth) : suite.camMonth;
    const insMonth = typeof suite.insMonth === 'string' ? parseFloat(suite.insMonth) : suite.insMonth;
    const taxMonth = typeof suite.taxMonth === 'string' ? parseFloat(suite.taxMonth) : suite.taxMonth;
    
    return {
      suiteId: suite.suiteId,
      propertyId: suite.propertyId,
      squareFootage,
      tiPerSf: suite.tiPerSf,
      baseRentPerSf: suite.baseRentPerSf,
      camPerSf: this.formatDecimalToString(squareFootage > 0 ? (camMonth * 12) / squareFootage : 0),
      insPerSf: this.formatDecimalToString(squareFootage > 0 ? (insMonth * 12) / squareFootage : 0),
      taxPerSf: this.formatDecimalToString(squareFootage > 0 ? (taxMonth * 12) / squareFootage : 0),
      rcd: suite.rcd ?? null,
      charges: {
        baseRentMonth: suite.baseRentMonth,
        camMonth: suite.camMonth,
        insMonth: suite.insMonth,
        taxMonth: suite.taxMonth,
        totalDueMonth: suite.totalDueMonth,
      },
      balanceDue: 0, // Default value
      leaseTerms: {
        rentDueDate: null,
        lateAfter: null,
        lateFee: 0,
      },
      monthlyPayments: suite.monthlyPayments,
      status: suite.status,
    };
  }

  /**
   * Convert ForeSight SuiteDataDto to BudgetSuiteUpdateDto format
   */
  private convertForeSightSuiteToUpdate(
    foreSightSuite: SuiteDataDto,
    propertyId: string,
  ): BudgetSuiteUpdateDto {
    // Calculate per SF values from ForeSight data
    const squareFootage = 1000; // Default, should be extracted from suite data if available
    const baseRentMonth = typeof foreSightSuite.charges?.baseRentMonth === 'string' 
      ? parseFloat(foreSightSuite.charges.baseRentMonth) 
      : (foreSightSuite.charges?.baseRentMonth || 0);
    const camMonth = typeof foreSightSuite.charges?.camMonth === 'string'
      ? parseFloat(foreSightSuite.charges.camMonth)
      : (foreSightSuite.charges?.camMonth || 0);
    const insMonth = typeof foreSightSuite.charges?.insMonth === 'string'
      ? parseFloat(foreSightSuite.charges.insMonth)
      : (foreSightSuite.charges?.insMonth || 0);
    const taxMonth = typeof foreSightSuite.charges?.taxMonth === 'string'
      ? parseFloat(foreSightSuite.charges.taxMonth)
      : (foreSightSuite.charges?.taxMonth || 0);

    return {
      suiteId: foreSightSuite.suiteId,
      propertyId,
      squareFootage,
      tiPerSf: this.formatDecimalToString(0), // TI/SF calculation would need to be implemented for PDF
      baseRentPerSf: this.formatDecimalToString(baseRentMonth > 0 ? (baseRentMonth * 12) / squareFootage : 0),
      camPerSf: this.formatDecimalToString(camMonth > 0 ? (camMonth * 12) / squareFootage : 0),
      insPerSf: this.formatDecimalToString(insMonth > 0 ? (insMonth * 12) / squareFootage : 0),
      taxPerSf: this.formatDecimalToString(taxMonth > 0 ? (taxMonth * 12) / squareFootage : 0),
      rcd: null,
      charges: {
        baseRentMonth: baseRentMonth.toString(),
        camMonth: camMonth.toString(),
        insMonth: insMonth.toString(),
        taxMonth: taxMonth.toString(),
        totalDueMonth: (baseRentMonth + camMonth + insMonth + taxMonth).toString(),
      },
      balanceDue: foreSightSuite.balanceDue || 0,
      leaseTerms: foreSightSuite.leaseTerms || {
        rentDueDate: null,
        lateAfter: null,
        lateFee: 0,
      },
      monthlyPayments: foreSightSuite.monthlyPayments || {
        jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
        jul: 0, aug: 0, sept: 0, oct: 0, nov: 0, dec: 0,
      },
      status: 'Vacant',
    };
  }

  /**
   * Update suites in database with budget data
   */
  private async updateSuitesFromBudget(
    propertyId: string,
    suiteUpdates: BudgetSuiteUpdateDto[],
  ): Promise<void> {
    this.logger.log(`Updating ${suiteUpdates.length} suites for property ${propertyId}`);

    for (const suiteUpdate of suiteUpdates) {
      try {
        // Prepare update data
        const updateData = {
          squareFootage: suiteUpdate.squareFootage,
          tiPerSf: suiteUpdate.tiPerSf,
          baseRentPerSf: suiteUpdate.baseRentPerSf,
          camPerSf: suiteUpdate.camPerSf,
          insPerSf: suiteUpdate.insPerSf,
          taxPerSf: suiteUpdate.taxPerSf,
          rcd: suiteUpdate.rcd,
          charges: suiteUpdate.charges,
          balanceDue: suiteUpdate.balanceDue,
          leaseTerms: suiteUpdate.leaseTerms,
          monthlyPayments: suiteUpdate.monthlyPayments,
          status: suiteUpdate.status,
        };

        // Upsert suite (create if doesn't exist, update if exists)
        const savedSuite = await this.suiteRepository.upsertSuite(
          propertyId,
          suiteUpdate.suiteId,
          updateData,
        );

        this.logger.log(
          `Updated suite ${suiteUpdate.suiteId}: TI/SF=${suiteUpdate.tiPerSf}, BaseRent/SF=${suiteUpdate.baseRentPerSf}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to update suite ${suiteUpdate.suiteId}: ${error.message}`,
        );
        // Continue with other suites even if one fails
      }
    }

    this.logger.log(`Completed updating suites for property ${propertyId}`);
  }

  /**
   * Format decimal number or string to string with exactly 2 decimal places
   */
  private formatDecimalToString(value: number | string): string {
    if (typeof value === 'string') {
      return value; // Already a string, return as-is
    }
    if (typeof value !== 'number' || isNaN(value)) {
      return '0.00';
    }
    return value.toFixed(2);
  }

  /**
   * Save or update suites from ForeSight extraction
   */
  async saveForeSightSuites(
    propertyId: string,
    suites: SuiteDataDto[],
  ): Promise<void> {
    this.logger.log(
      `Saving ${suites.length} suites for property ${propertyId}`,
    );

    const suitesToUpsert = suites.map((suite) => ({
      suiteId: suite.suiteId,
      data: {
        charges: {
          baseRentMonth: suite.charges.baseRentMonth.toString(),
          camMonth: suite.charges.camMonth.toString(),
          insMonth: suite.charges.insMonth.toString(),
          taxMonth: suite.charges.taxMonth.toString(),
          totalDueMonth: suite.charges.totalDueMonth.toString(),
        },
        balanceDue: suite.balanceDue,
        leaseTerms: suite.leaseTerms,
        monthlyPayments: suite.monthlyPayments,
      },
    }));

    this.logger.log(
      `Prepared ${suitesToUpsert.length} suites for upsert: ${suitesToUpsert.map((s) => s.suiteId).join(', ')}`,
    );

    await this.suiteRepository.upsertManySuites(propertyId, suitesToUpsert);

    this.logger.log(
      `Successfully saved ${suites.length} suites for property ${propertyId}`,
    );
  }

  /**
   * Get all suites for a property
   */
  async findByPropertyId(propertyId: string) {
    this.logger.log(`Fetching suites for property ${propertyId}`);
    return this.suiteRepository.findByPropertyId(propertyId);
  }

  /**
   * Get a specific suite by propertyId and suiteId
   */
  async findBySuiteId(propertyId: string, suiteId: string) {
    this.logger.log(
      `Fetching suite ${suiteId} for property ${propertyId}`,
    );
    return this.suiteRepository.findBySuiteId(propertyId, suiteId);
  }
}

