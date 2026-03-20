import { Injectable, Logger } from '@nestjs/common';
import { ExtractionResultDto } from './dto/extraction-result.dto';
import { SuiteDataDto } from './dto/suite-data.dto';
import { NumericCleanerUtil } from './utils/numeric-cleaner.util';
import { PdfParserUtil } from './utils/pdf-parser.util';

@Injectable()
export class ForeSightPdfExtractorService {
  private readonly logger = new Logger(ForeSightPdfExtractorService.name);

  /**
   * Extracts financial data from a ForeSight Detail Proforma PDF document.
   * 
   * @param pdfBuffer - The PDF file buffer to extract data from
   * @returns ExtractionResultDto containing structured financial data and extraction logs
   * @throws InternalServerErrorException if PDF parsing fails
   */
  async extractFinancialData(pdfBuffer: Buffer): Promise<ExtractionResultDto> {
    this.logger.log('Starting PDF extraction process');
    
    // Initialize extraction logs array
    const logs: string[] = [];
    
    try {
      // Call PdfParserUtil.parsePdf() to get text
      const pdfText = await PdfParserUtil.parsePdf(pdfBuffer);
      logs.push('PDF parsed successfully');
      this.logger.debug('PDF text extracted successfully');
      
      // Extract property-level information
      const propertyId = this.extractPropertyId(pdfText, logs);
      const propertyName = this.extractPropertyName(pdfText, logs);
      const region = this.extractRegion(pdfText, logs);
      
      // Extract all suite identifiers
      const suiteIdentifiers = this.extractSuiteIdentifiers(pdfText, logs);
      
      // Loop through identifiers and extract suite data
      const suites: SuiteDataDto[] = [];
      for (const identifier of suiteIdentifiers) {
        try {
          const suiteData = this.extractSuiteData(pdfText, identifier, logs);
          suites.push(suiteData);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logs.push(`Error extracting data for suite ${identifier}: ${errorMessage}`);
          this.logger.error(`Failed to extract suite ${identifier}: ${errorMessage}`);
        }
      }
      
      // Build ExtractionResultDto with timestamps
      const now = new Date().toISOString();
      const result: ExtractionResultDto = {
        propertyId,
        propertyName,
        region,
        suites,
        createdAt: now,
        updatedAt: now,
        extractionLogs: logs,
      };
      
      this.logger.log(`PDF extraction completed successfully. Extracted ${suites.length} suites.`);
      return result;
      
    } catch (error) {
      // Handle errors and add to logs
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logs.push(`Extraction failed: ${errorMessage}`);
      this.logger.error(`PDF extraction failed: ${errorMessage}`);
      
      // Re-throw the error to be handled by the controller
      throw error;
    }
  }

  /**
   * Extracts the Property ID from suite identifiers in the PDF text.
   * Property ID is the first 6 digits in the format "PPPPPP-SSS".
   * 
   * @param text - The parsed PDF text content
   * @param logs - Array to append extraction logs to
   * @returns The extracted Property ID or "UNKNOWN" if not found
   */
  private extractPropertyId(text: string, logs: string[]): string {
    const pattern = /(\d{6})-\d{3}/;
    const match = pattern.exec(text);
    
    if (match) {
      const propertyId = match[1];
      logs.push(`Property ID extracted from suite identifier: ${propertyId}`);
      this.logger.debug(`Extracted Property ID: ${propertyId}`);
      return propertyId;
    } else {
      logs.push('Property ID not found, using default');
      this.logger.warn('Property ID not found in PDF text');
      return 'UNKNOWN';
    }
  }

  /**
   * Extracts the property name from the PDF text.
   * Looks for a pattern like "Property Name: <name>".
   * 
   * @param text - The parsed PDF text content
   * @param logs - Array to append extraction logs to
   * @returns The extracted property name or "UNKNOWN" if not found
   */
  private extractPropertyName(text: string, logs: string[]): string {
    const pattern = /Property Name:\s*([^\n]+)/;
    const match = pattern.exec(text);
    
    if (match) {
      const propertyName = match[1].trim();
      logs.push(`Property name extracted: ${propertyName}`);
      this.logger.debug(`Extracted Property Name: ${propertyName}`);
      return propertyName;
    } else {
      logs.push('Property name not found');
      this.logger.warn('Property name not found in PDF text');
      return 'UNKNOWN';
    }
  }

  /**
   * Extracts the region code from the PDF text.
   * Looks for a pattern like "Region: <XX>" where XX is a 2-letter code.
   * 
   * @param text - The parsed PDF text content
   * @param logs - Array to append extraction logs to
   * @returns The extracted region code or "UNKNOWN" if not found
   */
  private extractRegion(text: string, logs: string[]): string {
    const pattern = /Region:\s*([A-Z]{2})/;
    const match = pattern.exec(text);
    
    if (match) {
      const region = match[1];
      logs.push(`Region extracted: ${region}`);
      this.logger.debug(`Extracted Region: ${region}`);
      return region;
    } else {
      logs.push('Region not found');
      this.logger.warn('Region not found in PDF text');
      return 'UNKNOWN';
    }
  }

  /**
   * Extracts all suite identifiers from the PDF text.
   * Suite identifiers follow the format "PPPPPP-SSS" where:
   * - PPPPPP is a 6-digit Property ID
   * - SSS is a 3-digit Suite ID
   * 
   * @param text - The parsed PDF text content
   * @param logs - Array to append extraction logs to
   * @returns Array of unique suite identifiers found in the PDF
   */
  private extractSuiteIdentifiers(text: string, logs: string[]): string[] {
    const pattern = /(\d{6}-\d{3})/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    
    // Find all matches using global regex
    while ((match = pattern.exec(text)) !== null) {
      matches.push(match[1]);
    }
    
    // Get unique identifiers only
    const uniqueIdentifiers = [...new Set(matches)];
    
    logs.push(`Found ${uniqueIdentifiers.length} unique suite identifiers`);
    this.logger.debug(`Extracted suite identifiers: ${uniqueIdentifiers.join(', ')}`);
    
    return uniqueIdentifiers;
  }

  /**
   * Extracts the base rent amount for a specific suite from the PDF text.
   * Looks for "Rental Income BRR" rows associated with the suite identifier.
   * 
   * @param text - The parsed PDF text content
   * @param identifier - The suite identifier in format "PPPPPP-SSS"
   * @param logs - Array to append extraction logs to
   * @returns The extracted base rent amount or 0 if not found
   */
  private extractBaseRent(text: string, identifier: string, logs: string[]): number {
    // Pattern to find "Rental Income BRR" row for this suite
    // Matches: identifier followed by "Rental Income BRR" and a numeric value
    const pattern = new RegExp(`${identifier}.*?Rental Income BRR.*?\\$?([\\d,]+\\.?\\d*)`, 's');
    const match = pattern.exec(text);
    
    if (match) {
      const value = NumericCleanerUtil.cleanNumeric(match[1]);
      logs.push(`Base Rent for ${identifier}: ${value}`);
      this.logger.debug(`Extracted Base Rent for ${identifier}: ${value}`);
      return value;
    } else {
      logs.push(`Base Rent not found for ${identifier}, using 0`);
      this.logger.debug(`Base Rent not found for ${identifier}`);
      return 0;
    }
  }

  /**
   * Extracts the CAM (Common Area Maintenance) recovery amount for a specific suite from the PDF text.
   * Looks for "CAM Recovery - Billed" rows associated with the suite identifier.
   * 
   * @param text - The parsed PDF text content
   * @param identifier - The suite identifier in format "PPPPPP-SSS"
   * @param logs - Array to append extraction logs to
   * @returns The extracted CAM amount or 0 if not found
   */
  private extractCAM(text: string, identifier: string, logs: string[]): number {
    // Pattern to find "CAM Recovery - Billed" row for this suite
    // Matches: identifier followed by "CAM Recovery - Billed" and a numeric value
    const pattern = new RegExp(`${identifier}.*?CAM Recovery - Billed.*?\\$?([\\d,]+\\.?\\d*)`, 's');
    const match = pattern.exec(text);
    
    if (match) {
      const value = NumericCleanerUtil.cleanNumeric(match[1]);
      logs.push(`CAM for ${identifier}: ${value}`);
      this.logger.debug(`Extracted CAM for ${identifier}: ${value}`);
      return value;
    } else {
      logs.push(`CAM not found for ${identifier}, using 0`);
      this.logger.debug(`CAM not found for ${identifier}`);
      return 0;
    }
  }

  /**
   * Extracts the insurance recovery amount for a specific suite from the PDF text.
   * Looks for "INS Recovery - Billed" rows associated with the suite identifier.
   *
   * @param text - The parsed PDF text content
   * @param identifier - The suite identifier in format "PPPPPP-SSS"
   * @param logs - Array to append extraction logs to
   * @returns The extracted insurance amount or 0 if not found
   */
  private extractInsurance(text: string, identifier: string, logs: string[]): number {
    // Pattern to find "INS Recovery - Billed" row for this suite
    // Matches: identifier followed by "INS Recovery - Billed" and a numeric value
    const pattern = new RegExp(`${identifier}.*?INS Recovery - Billed.*?\\$?([\\d,]+\\.?\\d*)`, 's');
    const match = pattern.exec(text);

    if (match) {
      const value = NumericCleanerUtil.cleanNumeric(match[1]);
      logs.push(`Insurance for ${identifier}: ${value}`);
      this.logger.debug(`Extracted Insurance for ${identifier}: ${value}`);
      return value;
    } else {
      logs.push(`Insurance not found for ${identifier}, using 0`);
      this.logger.debug(`Insurance not found for ${identifier}`);
      return 0;
    }
  }

  /**
   * Extracts the tax recovery amount for a specific suite from the PDF text.
   * Looks for "RET Recovery - Billed" rows associated with the suite identifier.
   *
   * @param text - The parsed PDF text content
   * @param identifier - The suite identifier in format "PPPPPP-SSS"
   * @param logs - Array to append extraction logs to
   * @returns The extracted tax amount or 0 if not found
   */
  private extractTax(text: string, identifier: string, logs: string[]): number {
    // Pattern to find "RET Recovery - Billed" row for this suite
    // Matches: identifier followed by "RET Recovery - Billed" and a numeric value
    const pattern = new RegExp(`${identifier}.*?RET Recovery - Billed.*?\\$?([\\d,]+\\.?\\d*)`, 's');
    const match = pattern.exec(text);

    if (match) {
      const value = NumericCleanerUtil.cleanNumeric(match[1]);
      logs.push(`Tax for ${identifier}: ${value}`);
      this.logger.debug(`Extracted Tax for ${identifier}: ${value}`);
      return value;
    } else {
      logs.push(`Tax not found for ${identifier}, using 0`);
      this.logger.debug(`Tax not found for ${identifier}`);
      return 0;
    }
  }

  /**
   * Extracts monthly payment amounts for all 12 months for a specific suite from the PDF text.
   * Monthly payments are calculated as BRR + CAM + INS + RET for each month.
   *
   * @param text - The parsed PDF text content
   * @param identifier - The suite identifier in format "PPPPPP-SSS"
   * @param logs - Array to append extraction logs to
   * @returns Object containing payment amounts for all 12 months (jan-dec)
   */
  private extractMonthlyPayments(text: string, identifier: string, logs: string[]): {
    jan: number;
    feb: number;
    mar: number;
    apr: number;
    may: number;
    jun: number;
    jul: number;
    aug: number;
    sept: number;
    oct: number;
    nov: number;
    dec: number;
  } {
    // Define month names as they appear in the PDF
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];

    const payments: any = {};

    // Loop through all 12 months
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const monthKey = monthKeys[i];

      // Pattern to find monthly payment value for this suite and month
      // Matches: identifier followed by month name and a numeric value
      const pattern = new RegExp(`${identifier}.*?${month}.*?\\$?([\\d,]+\\.?\\d*)`, 's');
      const match = pattern.exec(text);

      if (match) {
        const value = NumericCleanerUtil.cleanNumeric(match[1]);
        payments[monthKey] = value;
        this.logger.debug(`Extracted ${month} payment for ${identifier}: ${value}`);
      } else {
        payments[monthKey] = 0;
        this.logger.debug(`${month} payment not found for ${identifier}, using 0`);
      }
    }

    logs.push(`Extracted monthly payments for ${identifier}`);

    return payments;
  }
  /**
   * Calculates the total due per month for a suite.
   * Total due is calculated as: Base Rent + CAM + Insurance + Tax.
   * Missing values are treated as 0 in the calculation.
   *
   * @param baseRent - The base rent amount
   * @param cam - The CAM recovery amount
   * @param ins - The insurance recovery amount
   * @param tax - The tax recovery amount
   * @param identifier - The suite identifier for logging purposes
   * @param logs - Array to append extraction logs to
   * @returns The calculated total due per month
   */
  private calculateTotalDueMonth(
    baseRent: number,
    cam: number,
    ins: number,
    tax: number,
    identifier: string,
    logs: string[],
  ): number {
    // Handle missing values as 0
    const safeBaseRent = baseRent || 0;
    const safeCam = cam || 0;
    const safeIns = ins || 0;
    const safeTax = tax || 0;

    // Calculate total
    const totalDueMonth = safeBaseRent + safeCam + safeIns + safeTax;

    // Log calculation formula
    logs.push(
      `Calculated Total Due/Month for suite ${identifier}: ${totalDueMonth} (Base Rent: ${safeBaseRent} + CAM: ${safeCam} + INS: ${safeIns} + TAX: ${safeTax})`,
    );
    this.logger.debug(
      `Total Due/Month for ${identifier}: ${totalDueMonth} = ${safeBaseRent} + ${safeCam} + ${safeIns} + ${safeTax}`,
    );

    return totalDueMonth;
  }
  /**
   * Extracts complete suite data including charges, lease terms, and monthly payments.
   * Assembles all extracted data into a SuiteDataDto object.
   *
   * @param text - The parsed PDF text content
   * @param identifier - The suite identifier in format "PPPPPP-SSS"
   * @param logs - Array to append extraction logs to
   * @returns Complete SuiteDataDto object with all extracted and calculated data
   */
  private extractSuiteData(text: string, identifier: string, logs: string[]): SuiteDataDto {
    // Parse suite identifier to extract suite ID
    const parts = identifier.split('-');
    const suiteId = parts[1];

    logs.push(`Extracting data for suite: ${suiteId}`);
    this.logger.debug(`Starting extraction for suite: ${suiteId} (${identifier})`);

    // Extract financial charges
    const baseRent = this.extractBaseRent(text, identifier, logs);
    const cam = this.extractCAM(text, identifier, logs);
    const ins = this.extractInsurance(text, identifier, logs);
    const tax = this.extractTax(text, identifier, logs);

    // Calculate total due per month
    const totalDueMonth = this.calculateTotalDueMonth(baseRent, cam, ins, tax, identifier, logs);

    // Extract monthly payments
    const monthlyPayments = this.extractMonthlyPayments(text, identifier, logs);

    // Build suite data with default values for missing lease terms
    const suiteData = {
      suiteId: suiteId,
      charges: {
        baseRentMonth: baseRent,
        camMonth: cam,
        insMonth: ins,
        taxMonth: tax,
        totalDueMonth: totalDueMonth,
      },
      balanceDue: 0, // Default value as per requirement 10.1
      leaseTerms: {
        rentDueDate: null, // Default value as per requirement 10.2
        lateAfter: null, // Default value as per requirement 10.3
        lateFee: 0, // Default value as per requirement 10.4
      },
      monthlyPayments: monthlyPayments,
    };

    logs.push(`Completed extraction for suite: ${suiteId}`);
    this.logger.debug(`Completed extraction for suite: ${suiteId}`);

    return suiteData;
  }

}
