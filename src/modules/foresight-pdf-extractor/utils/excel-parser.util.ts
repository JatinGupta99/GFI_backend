import { InternalServerErrorException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ExtractionResultDto } from '../dto/extraction-result.dto';
import { SuiteDataDto } from '../dto/suite-data.dto';
import { NumericCleanerUtil } from './numeric-cleaner.util';

/**
 * Utility class for parsing Excel files and extracting ForeSight financial data.
 */
export class ExcelParserUtil {
  /**
   * Parses an Excel buffer and extracts financial data in the same format as PDF extraction.
   *
   * @param buffer - The Excel file buffer to parse
   * @returns The extracted financial data as ExtractionResultDto
   * @throws InternalServerErrorException if the Excel cannot be parsed
   */
  static extractFinancialData(buffer: Buffer): ExtractionResultDto {
    const logs: string[] = [];

    try {
      // Parse the Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      logs.push('Excel file parsed successfully');

      // Process ALL sheets in the workbook
      const allData: any[][] = [];
      
      logs.push(`Total sheets in workbook: ${workbook.SheetNames.length}`);
      
      for (const sheetName of workbook.SheetNames) {
        logs.push(`Processing sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
        });
        
        logs.push(`Sheet ${sheetName} has ${sheetData.length} rows`);
        
        // Append all rows from this sheet to allData
        allData.push(...sheetData);
      }
      
      logs.push(`Total combined rows: ${allData.length}`);

      // Extract property information from combined data
      const propertyId = this.extractPropertyId(allData, logs);
      const propertyName = this.extractPropertyName(allData, logs);
      const region = this.extractRegion(allData, logs);

      // Extract suite data from combined data
      const suites = this.extractSuites(allData, logs);

      return {
        propertyId,
        propertyName,
        region,
        suites,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        extractionLogs: logs,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Failed to parse Excel: ${errorMessage}`,
      );
    }
  }

  private static extractPropertyId(data: any[][], logs: string[]): string {
    // Look for property ID in the data
    // Format: "6564 - Richwood" or similar
    for (const row of data) {
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          const match = cell.match(/(\d{4,6})\s*-\s*/);
          if (match) {
            const propertyId = match[1].padStart(6, '0');
            logs.push(`Property ID extracted: ${propertyId}`);
            return propertyId;
          }
        }
      }
    }

    logs.push('Property ID not found, using default');
    return 'UNKNOWN';
  }

  private static extractPropertyName(data: any[][], logs: string[]): string {
    // Look for property name after the property ID
    for (const row of data) {
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          const match = cell.match(/\d{4,6}\s*-\s*(.+)/);
          if (match) {
            const propertyName = match[1].trim();
            logs.push(`Property name extracted: ${propertyName}`);
            return propertyName;
          }
        }
      }
    }

    logs.push('Property name not found');
    return 'UNKNOWN';
  }

  private static extractRegion(data: any[][], logs: string[]): string {
    // Look for region code (typically 2 letters)
    for (const row of data) {
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          const match = cell.match(/\b([A-Z]{2})\b/);
          if (match && match[1] !== 'AM' && match[1] !== 'PM') {
            logs.push(`Region extracted: ${match[1]}`);
            return match[1];
          }
        }
      }
    }

    logs.push('Region not found');
    return 'UNKNOWN';
  }

  private static extractSuites(data: any[][], logs: string[]): SuiteDataDto[] {
    const suitesMap = new Map<string, SuiteDataDto>();
    let headerRowIndex = -1;
    let monthColumns: number[] = [];

    // Find the header row with month columns
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Find month column indices
      for (let j = 0; j < row.length; j++) {
        if (row[j] && /^\d{2}\/\d{2}$/.test(row[j].toString().trim())) {
          if (monthColumns.length === 0) {
            headerRowIndex = i;
          }
          monthColumns.push(j);
        }
      }
      if (monthColumns.length >= 12) {
        logs.push(
          `Found header row at index ${i} with ${monthColumns.length} month columns`,
        );
        break;
      }
    }

    if (headerRowIndex === -1 || monthColumns.length === 0) {
      logs.push('Could not find header row with month columns');
      return [];
    }

    // Process data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      // Look for suite identifier in format "006564-2111" or "(BRR) 006564-2111"
      const rowText = row.join(' ');
      const suiteMatch = rowText.match(/(\d{6})-(\d{3,4})/);

      if (suiteMatch) {
        const fullIdentifier = suiteMatch[0];
        const suiteId = suiteMatch[2];

        // Check if this is a BRR (base rent), CAM, INS, or RET row
        const rowType = this.identifyRowType(rowText);
        
        if (!rowType) {
          // Skip rows that don't match any known type
          continue;
        }
        
        logs.push(`Row type detected: ${rowType} for suite ${suiteId}`);

        // Get or create suite data
        if (!suitesMap.has(suiteId)) {
          suitesMap.set(suiteId, {
            suiteId,
            charges: {
              baseRentMonth: 0,
              camMonth: 0,
              insMonth: 0,
              taxMonth: 0,
              totalDueMonth: 0,
            },
            balanceDue: 0,
            leaseTerms: {
              rentDueDate: null,
              lateAfter: null,
              lateFee: 0,
            },
            monthlyPayments: {
              jan: 0,
              feb: 0,
              mar: 0,
              apr: 0,
              may: 0,
              jun: 0,
              jul: 0,
              aug: 0,
              sept: 0,
              oct: 0,
              nov: 0,
              dec: 0,
            },
          });
          logs.push(`Created suite: ${suiteId}`);
        }

        const suiteData = suitesMap.get(suiteId)!;

        // Extract value from first month column
        const firstMonthValue =
          monthColumns.length > 0 && row[monthColumns[0]]
            ? NumericCleanerUtil.cleanNumeric(row[monthColumns[0]].toString())
            : 0;

        // Update charges based on row type
        if (rowType === 'BRR') {
          suiteData.charges.baseRentMonth = firstMonthValue;
          logs.push(`Suite ${suiteId} - Base Rent: ${firstMonthValue}`);
        } else if (rowType === 'CAM') {
          suiteData.charges.camMonth = firstMonthValue;
          logs.push(`Suite ${suiteId} - CAM: ${firstMonthValue}`);
        } else if (rowType === 'INS') {
          suiteData.charges.insMonth = firstMonthValue;
          logs.push(`Suite ${suiteId} - Insurance: ${firstMonthValue}`);
        } else if (rowType === 'RET') {
          suiteData.charges.taxMonth = firstMonthValue;
          logs.push(`Suite ${suiteId} - Tax: ${firstMonthValue}`);
        }

        // Extract monthly payments if this is a BRR row
        if (rowType === 'BRR') {
          suiteData.monthlyPayments = this.extractMonthlyPayments(
            row,
            monthColumns,
            logs,
          );
        }
      }
    }

    // Calculate total due for each suite
    const suites = Array.from(suitesMap.values());
    suites.forEach((suite) => {
      suite.charges.totalDueMonth =
        suite.charges.baseRentMonth +
        suite.charges.camMonth +
        suite.charges.insMonth +
        suite.charges.taxMonth;
      logs.push(
        `Suite ${suite.suiteId} - Total Due: ${suite.charges.totalDueMonth}`,
      );
    });

    logs.push(`Extracted ${suites.length} unique suites`);
    return suites;
  }

  private static identifyRowType(rowText: string): string | null {
    const lowerText = rowText.toLowerCase();
    
    // Check for CAM Recovery first (most specific)
    if (lowerText.includes('cam recovery') || lowerText.includes('(cam)')) {
      return 'CAM';
    }
    // Check for INS Recovery
    if (lowerText.includes('ins recovery') || lowerText.includes('(ins)')) {
      return 'INS';
    }
    // Check for RET Recovery (Tax)
    if (lowerText.includes('ret recovery') || lowerText.includes('(ret)') || lowerText.includes('(tax)')) {
      return 'RET';
    }
    // Check for BRR (Base Rent) - check last to avoid false positives
    if (lowerText.includes('rental income') || lowerText.includes('(brr)') || lowerText.includes('base rent')) {
      return 'BRR';
    }
    
    return null;
  }

  private static extractMonthlyPayments(
    row: any[],
    monthColumns: number[],
    logs: string[],
  ): any {
    const months = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sept',
      'oct',
      'nov',
      'dec',
    ];
    const payments: any = {};

    for (let i = 0; i < 12; i++) {
      const columnIndex = monthColumns[i];
      const value =
        columnIndex !== undefined && row[columnIndex]
          ? NumericCleanerUtil.cleanNumeric(row[columnIndex].toString())
          : 0;
      payments[months[i]] = value;
    }

    return payments;
  }
}
