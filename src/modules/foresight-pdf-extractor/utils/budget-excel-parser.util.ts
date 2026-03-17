import { InternalServerErrorException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { NumericCleanerUtil } from './numeric-cleaner.util';

export interface ExcelSuiteData {
  propertyId: string;
  suiteId: string;
  status: 'Vacant' | 'Occupied' | 'Unknown' | 'Proposed';
  squareFootage: number;
  baseRentMonth: number;
  baseRentPerSf: number;
  camMonth: number;
  insMonth: number;
  taxMonth: number;
  totalDueMonth: number;
  tiPerSf: number;
  rcd: string | null;
  monthlyPayments: {
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
  };
}

// Keep the old interface for backward compatibility
export interface BudgetSuiteData {
  suiteId: string;
  squareFootage: number;
  tiPerSf: number;
  baseRentPerSf: number;
  camPerSf: number;
  insPerSf: number;
  taxPerSf: number;
  proposedValues: {
    baseRent: number;
    cam: number;
    insurance: number;
    tax: number;
    tenantImprovement: number;
  };
  monthlyPayments: {
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
  };
}

export interface ExcelExtractionResult {
  success: boolean;
  suites: ExcelSuiteData[];
  extractionLogs: string[];
  errors: string[];
}

// Keep the old interface for backward compatibility
export interface BudgetExtractionResult {
  propertyId: string;
  propertyName: string;
  suites: BudgetSuiteData[];
  extractionLogs: string[];
}

/**
 * Interface for tenant row information
 */
interface TenantRowInfo {
  rowIndex: number;
  suiteId: string;
  propertyId: string;
  status: 'Vacant' | 'Occupied' | 'Unknown' | 'Proposed';
  tenantName: string;
  section: string;
}

/**
 * Utility class for parsing budget Excel files and calculating TI/SF and Base Rent/SF
 */
export class BudgetExcelParserUtil {
  /**
   * Parses a budget Excel file and extracts TI/SF and Base Rent/SF calculations
   *
   * @param buffer - The Excel file buffer to parse
   * @returns The extracted budget data with calculated values
   * @throws InternalServerErrorException if the Excel cannot be parsed
   */
  static extractBudgetData(buffer: Buffer): BudgetExtractionResult {
    const logs: string[] = [];

    try {
      // Parse the Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      logs.push('Budget Excel file parsed successfully');
      logs.push(`Sheet names: ${workbook.SheetNames.join(', ')}`);

      // Process ALL sheets in the workbook
      const allData: any[][] = [];
      
      for (const sheetName of workbook.SheetNames) {
        logs.push(`Processing sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON with raw values
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: '', // Use empty string for empty cells
        });
        
        logs.push(`Sheet ${sheetName} has ${sheetData.length} rows`);
        
        // Log first few rows for debugging
        for (let i = 0; i < Math.min(10, sheetData.length); i++) {
          const row = sheetData[i];
          if (row && row.length > 0) {
            logs.push(`Sheet ${sheetName} Row ${i}: ${JSON.stringify(row.slice(0, 15))}`);
          }
        }
        
        // Append all rows from this sheet to allData
        allData.push(...sheetData);
      }
      
      logs.push(`Total combined rows: ${allData.length}`);

      // Extract property information
      const propertyId = this.extractPropertyId(allData, logs);
      const propertyName = this.extractPropertyName(allData, logs);

      // Extract suite data with TI/SF and Base Rent/SF calculations
      const suites = this.extractSuitesWithCalculations(allData, logs);

      return {
        propertyId,
        propertyName,
        suites,
        extractionLogs: logs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logs.push(`Error: ${errorMessage}`);
      throw new InternalServerErrorException(`Failed to parse budget Excel: ${errorMessage}`);
    }
  }

  private static extractPropertyId(data: any[][], logs: string[]): string {
    // Look for property ID in the data - specifically "6564 - Richwood" format
    for (const row of data) {
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          // Look for pattern like "6564 - Richwood"
          const match = cell.match(/(\d{4,6})\s*-\s*\w+/);
          if (match) {
            const propertyId = match[1].padStart(6, '0');
            logs.push(`Property ID extracted: ${propertyId} from "${cell}"`);
            return propertyId;
          }
          
          // Fallback to original pattern
          const fallbackMatch = cell.match(/(\d{4,6})\s*-?\s*/);
          if (fallbackMatch) {
            const propertyId = fallbackMatch[1].padStart(6, '0');
            logs.push(`Property ID extracted (fallback): ${propertyId}`);
            return propertyId;
          }
        }
      }
    }

    logs.push('Property ID not found, using default');
    return 'UNKNOWN';
  }

  private static extractPropertyName(data: any[][], logs: string[]): string {
    // Look for property name in the data - specifically "6564 - Richwood" format
    for (const row of data) {
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          // Look for pattern like "6564 - Richwood"
          const match = cell.match(/\d{4,6}\s*-\s*(\w+)/);
          if (match) {
            const propertyName = match[1];
            logs.push(`Property name extracted: ${propertyName} from "${cell}"`);
            return propertyName;
          }
          
          // Look for patterns like "2026 Richwood Budget"
          const budgetMatch = cell.match(/\d{4}\s+(\w+)\s+Budget/i);
          if (budgetMatch) {
            const propertyName = budgetMatch[1];
            logs.push(`Property name extracted from budget: ${propertyName}`);
            return propertyName;
          }
        }
      }
    }

    logs.push('Property name not found');
    return 'UNKNOWN';
  }

  private static extractSuitesWithCalculations(data: any[][], logs: string[]): BudgetSuiteData[] {
    const suitesMap = new Map<string, BudgetSuiteData>();
    let monthColumns: number[] = [];
    let headerRowIndex = -1;

    // Find the header row with month columns
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      monthColumns = [];
      
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'string') {
          // Look for month patterns like "Jan", "Feb", etc. or "01/26", "02/26", etc.
          if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(cell) ||
              /^\d{2}\/\d{2}$/.test(cell) ||
              /^(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(cell)) {
            monthColumns.push(j);
          }
        }
      }
      
      if (monthColumns.length >= 12) {
        headerRowIndex = i;
        logs.push(`Found header row at index ${i} with ${monthColumns.length} month columns`);
        logs.push(`Month columns at positions: ${monthColumns.join(', ')}`);
        break;
      }
    }

    if (headerRowIndex === -1) {
      logs.push('Could not find header row with month columns');
      // Try alternative approach - look for numeric patterns that might be months
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        let numericColumns = 0;
        monthColumns = [];
        
        for (let j = 0; j < row.length; j++) {
          const cell = row[j];
          if (cell && !isNaN(parseFloat(cell.toString()))) {
            monthColumns.push(j);
            numericColumns++;
          }
        }
        
        if (numericColumns >= 12) {
          headerRowIndex = i;
          monthColumns = monthColumns.slice(0, 12); // Take first 12 numeric columns
          logs.push(`Using alternative approach - found numeric row at index ${i}`);
          break;
        }
      }
    }

    // Process all rows to find suite data
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const rowText = row.join(' ').toString().toLowerCase();
      
      // Log every row for debugging
      if (i < 50) { // Log first 50 rows
        logs.push(`Row ${i}: ${rowText.substring(0, 100)}...`);
      }

      // Look for suite numbers in various formats
      const suiteMatch = this.findSuiteNumber(row, logs);
      if (suiteMatch) {
        const { suiteId, squareFootage } = suiteMatch;
        logs.push(`Found suite ${suiteId} with ${squareFootage} SF at row ${i}`);

        // Initialize suite if not exists
        if (!suitesMap.has(suiteId)) {
          suitesMap.set(suiteId, {
            suiteId,
            squareFootage,
            tiPerSf: 0,
            baseRentPerSf: 0,
            camPerSf: 0,
            insPerSf: 0,
            taxPerSf: 0,
            proposedValues: {
              baseRent: 0,
              cam: 0,
              insurance: 0,
              tax: 0,
              tenantImprovement: 0,
            },
            monthlyPayments: {
              jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
              jul: 0, aug: 0, sept: 0, oct: 0, nov: 0, dec: 0,
            },
          });
        }

        const suiteData = suitesMap.get(suiteId)!;

        // Look for "Proposed" or financial data in this row or nearby rows
        if (rowText.includes('proposed') || rowText.includes('budget') || rowText.includes('rent')) {
          logs.push(`Found potential financial data row for suite ${suiteId} at row ${i}`);
          
          // Extract monthly payments from this row
          if (monthColumns.length > 0) {
            const monthlyPayments = this.extractMonthlyPayments(row, monthColumns, logs);
            const hasNonZeroValues = Object.values(monthlyPayments).some((val: any) => typeof val === 'number' && val > 0);
            
            if (hasNonZeroValues) {
              suiteData.monthlyPayments = monthlyPayments;
              logs.push(`Extracted monthly payments for suite ${suiteId}: ${JSON.stringify(monthlyPayments)}`);
              
              // Calculate proposed value from monthly payments
              const firstNonZeroValue = Object.values(monthlyPayments).find((val: any) => typeof val === 'number' && val > 0) as number || 0;
              if (firstNonZeroValue > 0) {
                // Determine section type based on context
                const sectionType = this.identifyBudgetSection(data, i, logs);
                
                switch (sectionType) {
                  case 'TENANT_IMPROVEMENT':
                    suiteData.proposedValues.tenantImprovement = firstNonZeroValue;
                    suiteData.tiPerSf = this.calculateTiPerSf(firstNonZeroValue, squareFootage);
                    break;
                  case 'BASE_RENT':
                    suiteData.proposedValues.baseRent = firstNonZeroValue;
                    suiteData.baseRentPerSf = this.calculatePerSf(firstNonZeroValue, squareFootage, 12);
                    break;
                  case 'CAM':
                    suiteData.proposedValues.cam = firstNonZeroValue;
                    suiteData.camPerSf = this.calculatePerSf(firstNonZeroValue, squareFootage, 12);
                    break;
                  case 'INSURANCE':
                    suiteData.proposedValues.insurance = firstNonZeroValue;
                    suiteData.insPerSf = this.calculatePerSf(firstNonZeroValue, squareFootage, 12);
                    break;
                  case 'TAX':
                    suiteData.proposedValues.tax = firstNonZeroValue;
                    suiteData.taxPerSf = this.calculatePerSf(firstNonZeroValue, squareFootage, 12);
                    break;
                  default:
                    // If we can't identify the section, assume it's base rent
                    suiteData.proposedValues.baseRent = firstNonZeroValue;
                    suiteData.baseRentPerSf = this.calculatePerSf(firstNonZeroValue, squareFootage, 12);
                    break;
                }
                
                logs.push(`Suite ${suiteId} - ${sectionType}: Value=${firstNonZeroValue}, PerSF=${this.calculatePerSf(firstNonZeroValue, squareFootage, 12)}`);
              }
            }
          }
        }
        
        // Also check if this row has numeric values in month columns
        if (monthColumns.length > 0) {
          let hasValues = false;
          for (const colIndex of monthColumns) {
            if (row[colIndex] && !isNaN(parseFloat(row[colIndex].toString()))) {
              const value = parseFloat(row[colIndex].toString());
              if (value > 0) {
                hasValues = true;
                break;
              }
            }
          }
          
          if (hasValues) {
            const monthlyPayments = this.extractMonthlyPayments(row, monthColumns, logs);
            suiteData.monthlyPayments = monthlyPayments;
            
            // Calculate base rent per SF from first non-zero value
            const firstNonZeroValue = Object.values(monthlyPayments).find((val: any) => typeof val === 'number' && val > 0) as number || 0;
            if (firstNonZeroValue > 0 && suiteData.proposedValues.baseRent === 0) {
              suiteData.proposedValues.baseRent = firstNonZeroValue;
              suiteData.baseRentPerSf = this.calculatePerSf(firstNonZeroValue, squareFootage, 12);
              logs.push(`Suite ${suiteId} - Calculated base rent from monthly: ${firstNonZeroValue}, PerSF: ${suiteData.baseRentPerSf}`);
            }
          }
        }
      }
    }

    // Handle second floor logic (if first two values are 0, set CAM/Tax/Insurance to 0)
    suitesMap.forEach((suite, suiteId) => {
      const firstTwoMonths = [suite.monthlyPayments.jan, suite.monthlyPayments.feb];
      if (firstTwoMonths.every(val => val === 0)) {
        logs.push(`Suite ${suiteId} appears to be on second floor - setting CAM/Tax/Insurance to 0`);
        suite.camPerSf = 0;
        suite.insPerSf = 0;
        suite.taxPerSf = 0;
        suite.proposedValues.cam = 0;
        suite.proposedValues.insurance = 0;
        suite.proposedValues.tax = 0;
      }
    });

    const suites = Array.from(suitesMap.values());
    logs.push(`Extracted ${suites.length} suites with calculations`);
    return suites;
  }

  private static findSuiteNumber(row: any[], logs: string[]): { suiteId: string; squareFootage: number } | null {
    const rowText = row.join(' ').toString();
    
    // Look for suite patterns specific to this format: "006564-2111", "006564-2131", etc.
    const suitePatterns = [
      /006564-(\d{4})/i, // Specific pattern for this property
      /\b\d{6}-(\d{4})\b/i, // General pattern for property-suite format
      /Suite\s+(\d{3,4})/i,
      /\b(\d{4})\b/,
      /\b(\d{3})\b/,
      /(\d{3,4})\s*SF/i, // Pattern like "350 SF"
      /(\d{3,4})\s*sq/i, // Pattern like "350 sq ft"
    ];

    for (const pattern of suitePatterns) {
      const match = rowText.match(pattern);
      if (match) {
        const suiteId = match[1];
        
        // Look for square footage in the same row or use suite number as potential SF
        let squareFootage = this.extractSquareFootage(row, logs);
        
        // For this specific format, try to derive square footage from suite number
        if (squareFootage === 1000) {
          const potentialSF = parseInt(suiteId);
          // Check if the suite number could be reasonable square footage
          if (potentialSF >= 300 && potentialSF <= 30000) {
            squareFootage = potentialSF;
          } else {
            // Use a mapping or default based on suite number patterns
            squareFootage = this.estimateSquareFootageFromSuite(suiteId);
          }
        }
        
        // Validate suite ID (should be 3-4 digits)
        if (suiteId.length >= 3 && suiteId.length <= 4) {
          logs.push(`Found suite ${suiteId} with estimated SF: ${squareFootage}`);
          return { suiteId, squareFootage };
        }
      }
    }

    return null;
  }

  private static estimateSquareFootageFromSuite(suiteId: string): number {
    // Estimate square footage based on suite number patterns
    const suiteNum = parseInt(suiteId);
    
    // Common patterns for suite numbering vs square footage
    if (suiteNum >= 2100 && suiteNum <= 2199) {
      // Suite 21xx series - typically smaller suites
      return Math.floor(suiteNum / 3); // Rough estimate
    } else if (suiteNum >= 1000 && suiteNum <= 9999) {
      // Use the suite number itself if it's in a reasonable SF range
      if (suiteNum >= 300 && suiteNum <= 30000) {
        return suiteNum;
      }
    }
    
    // Default square footage for unknown patterns
    return 1000;
  }

  private static extractSquareFootage(row: any[], logs: string[]): number {
    // Look for square footage patterns in the row
    for (const cell of row) {
      if (cell && typeof cell === 'string') {
        // Look for patterns like "1,200 SF", "1200", "632 sq ft", etc.
        const sfPatterns = [
          /(\d{1,3}(?:,\d{3})*)\s*(?:SF|sq\.?\s*ft\.?)/i,
          /(\d{3,5})\s*(?:SF|sq\.?\s*ft\.?)/i,
          /SF\s*(\d{1,3}(?:,\d{3})*)/i,
        ];
        
        for (const pattern of sfPatterns) {
          const sfMatch = cell.match(pattern);
          if (sfMatch) {
            const sf = NumericCleanerUtil.cleanNumeric(sfMatch[1]);
            if (sf > 100 && sf < 50000) { // Reasonable range for suite size
              return sf;
            }
          }
        }
      }
    }
    
    // Look for numeric values that could be square footage
    for (const cell of row) {
      if (cell && !isNaN(parseFloat(cell.toString()))) {
        const value = parseFloat(cell.toString());
        if (value > 300 && value < 30000) { // Reasonable SF range
          return Math.round(value);
        }
      }
    }
    
    // Default square footage if not found
    return 1000;
  }

  private static identifyBudgetSection(data: any[][], currentRowIndex: number, logs: string[]): string {
    // Look backwards from current row to find section header
    for (let i = currentRowIndex; i >= Math.max(0, currentRowIndex - 20); i--) {
      const row = data[i];
      if (!row) continue;
      
      const rowText = row.join(' ').toLowerCase();
      
      if (rowText.includes('rental income')) {
        return 'RENTAL INCOME';
      }
      if (rowText.includes('cam recovery')) {
        return 'CAM Recovery - Billed';
      }
      if (rowText.includes('ins recovery')) {
        return 'INS Recovery - Billed';
      }
      if (rowText.includes('ret recovery')) {
        return 'RET Recovery - Billed';
      }
      if (rowText.includes('tenant improvement')) {
        return 'Tenant Improvements';
      }
      if (rowText.includes('leasing commission')) {
        return 'Leasing Commission';
      }
    }
    
    return 'UNKNOWN';
  }

  private static extractProposedValue(row: any[], logs: string[]): number {
    // Look for the "Proposed" value in the row
    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      if (cell && typeof cell === 'string' && cell.toLowerCase().includes('proposed')) {
        // Look for numeric value in next few cells
        for (let j = i + 1; j < Math.min(row.length, i + 5); j++) {
          const valueCell = row[j];
          if (valueCell) {
            const numericValue = NumericCleanerUtil.cleanNumeric(valueCell.toString());
            if (numericValue > 0) {
              return numericValue;
            }
          }
        }
      }
    }
    
    return 0;
  }

  private static extractMonthlyPayments(row: any[], monthColumns: number[], logs: string[]): any {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];
    const payments: any = {};

    // For this specific Excel format, the monthly columns are at positions 2-13
    if (monthColumns.length === 0) {
      // Use fixed positions based on the Excel structure we observed
      const fixedMonthColumns = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
      
      for (let i = 0; i < 12; i++) {
        let value = 0;
        
        if (i < fixedMonthColumns.length) {
          const columnIndex = fixedMonthColumns[i];
          const cellValue = row[columnIndex];
          
          if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
            // Clean the numeric value (remove commas, etc.)
            const cleanValue = cellValue.toString().replace(/[,$]/g, '');
            const numericValue = parseFloat(cleanValue);
            if (!isNaN(numericValue)) {
              value = numericValue;
            }
          }
        }
        
        payments[months[i]] = value;
      }
      
      logs.push(`Extracted payments using fixed columns: ${JSON.stringify(payments)}`);
      return payments;
    }

    // Use defined month columns (fallback)
    for (let i = 0; i < 12; i++) {
      let value = 0;
      
      if (i < monthColumns.length) {
        const columnIndex = monthColumns[i];
        const cellValue = row[columnIndex];
        
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          // Clean the numeric value (remove commas, etc.)
          const cleanValue = cellValue.toString().replace(/[,$]/g, '');
          const numericValue = parseFloat(cleanValue);
          if (!isNaN(numericValue)) {
            value = numericValue;
          }
        }
      }
      
      payments[months[i]] = value;
    }

    return payments;
  }

  private static calculatePerSf(proposedValue: number, squareFootage: number, multiplier: number = 1): number {
    if (squareFootage === 0) return 0;
    
    const perSf = (proposedValue * multiplier) / squareFootage;
    return Math.round(perSf * 100) / 100; // Round to 2 decimal places
  }

  // New methods for enhanced Excel parsing

  /**
   * Find all tenant rows in the Excel worksheet
   */
  private static findTenantRows(worksheet: any): TenantRowInfo[] {
    const tenantRows: TenantRowInfo[] = [];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex] as any[];
      if (!row || row.length === 0) continue;
      
      // Look for tenant patterns in each cell of the row
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          const tenantInfo = this.extractTenantIdentifiers(cell);
          if (tenantInfo) {
            tenantRows.push({
              rowIndex,
              suiteId: tenantInfo.suiteId,
              propertyId: tenantInfo.propertyId,
              status: tenantInfo.status,
              tenantName: tenantInfo.tenantName,
              section: this.identifyBudgetSection(data, rowIndex, [])
            });
            break; // Found tenant in this row, move to next row
          }
        }
      }
    }
    
    return tenantRows;
  }

  /**
   * Extract tenant identifiers from a tenant line
   */
  private static extractTenantIdentifiers(cellValue: string): { 
    suiteId: string; 
    propertyId: string; 
    status: 'Vacant' | 'Occupied' | 'Unknown' | 'Proposed';
    tenantName: string;
  } | null {
    // Pattern 1: "- SSSS - [Tenant Name] (BRR) PPPPPP-SSSS" (leading dash optional)
    // Handles: "- 2111 - Proposed (BRR) 006564-2111"
    //          "- Proposed #18 (BRR) 008312-18"
    //          "- 98 Flowers (BRR) 006564-2131"
    const tenantPattern = /^-?\s*(.+?)\s*\([^)]+\)\s*(\d{5,6})-(\w{2,})\s*$/;
    const match = cellValue.trim().match(tenantPattern);

    if (match) {
      const rawLabel = match[1].trim();   // e.g. "2111 - Proposed" or "98 Flowers"
      const propertyId = match[2];        // e.g. "006564"
      const suiteId = match[3];           // e.g. "2111" or "18"

      // Determine status based on tenant name
      let status: 'Vacant' | 'Occupied' | 'Unknown' | 'Proposed';
      if (rawLabel.toLowerCase().includes('proposed')) {
        status = 'Proposed';
      } else if (rawLabel.trim().length > 0) {
        status = 'Occupied';
      } else {
        status = 'Unknown';
      }

      return { suiteId, propertyId, status, tenantName: rawLabel };
    }

    // Pattern 2: "SSSS - Proposed (TI)" for Tenant Improvements
    const tiPattern = /(\d{4})\s*-\s*([^(]+)\s*\(TI\)/;
    const tiMatch = cellValue.match(tiPattern);
    
    if (tiMatch) {
      const suiteId = tiMatch[1];
      const tenantName = tiMatch[2].trim();
      
      let status: 'Vacant' | 'Occupied' | 'Unknown' | 'Proposed';
      if (tenantName.toLowerCase().includes('proposed')) {
        status = 'Proposed';
      } else if (tenantName.trim().length > 0) {
        status = 'Occupied';
      } else {
        status = 'Unknown';
      }
      
      return {
        suiteId,
        propertyId: 'UNKNOWN',
        status,
        tenantName
      };
    }
    
    // Pattern 3: "Leasing Commission for SSSS - Proposed"
    const commissionPattern = /Leasing Commission for (\d+) - ([^"]+)/;
    const commissionMatch = cellValue.match(commissionPattern);
    
    if (commissionMatch) {
      const suiteId = commissionMatch[1];
      const tenantName = commissionMatch[2].trim();
      
      let status: 'Vacant' | 'Occupied' | 'Unknown' | 'Proposed';
      if (tenantName.toLowerCase().includes('proposed')) {
        status = 'Proposed';
      } else if (tenantName.trim().length > 0) {
        status = 'Occupied';
      } else {
        status = 'Unknown';
      }
      
      return {
        suiteId,
        propertyId: 'UNKNOWN',
        status,
        tenantName
      };
    }
    
    return null;
  }

  private static extractFromRentalIncomeSection(worksheet: any, tenantInfo: TenantRowInfo[]): Map<string, { baseRentMonth: number; squareFootage: number; rcd: string | null; monthlyPayments: any }> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const results = new Map<string, { baseRentMonth: number; squareFootage: number; rcd: string | null; monthlyPayments: any }>();

    // Read month header labels from the sheet (row where cols 2–13 look like "MM/YY")
    let headerLabels: string[] | undefined;
    for (const row of data) {
      const candidates = (row as any[]).slice(2, 14).map(c => String(c ?? ''));
      if (candidates.filter(c => /^\d{2}\/\d{2}$/.test(c)).length >= 12) {
        headerLabels = candidates;
        break;
      }
    }
    
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];

    for (const tenant of tenantInfo) {
      // Accept any section that contains rental income keywords (case-insensitive)
      const sectionLower = tenant.section.toLowerCase();
      if (!sectionLower.includes('rental income') && !sectionLower.includes('rental') && tenant.section !== 'UNKNOWN') continue;
      
      const row = data[tenant.rowIndex];
      if (!row) continue;
      
      // Extract all 12 monthly payments from columns 2–13
      const monthlyPayments: any = {};
      let baseRentMonth = 0;
      for (let i = 0; i < 12; i++) {
        const cell = row[i + 2];
        const val = typeof cell === 'number' ? cell : parseFloat(String(cell ?? '').replace(/,/g, ''));
        const amount = !isNaN(val) ? val : 0;
        monthlyPayments[months[i]] = amount;
        if (amount > 0 && baseRentMonth === 0) {
          baseRentMonth = amount;
        }
      }
      
      // Extract square footage from the last cell (format: "21268 500005")
      let squareFootage = 0;
      const lastCell = row[row.length - 1];
      if (lastCell && typeof lastCell === 'string') {
        const match = lastCell.match(/^(\d+)/);
        if (match) {
          squareFootage = parseInt(match[1]);
        }
      }
      // Also try numeric last cell
      if (squareFootage === 0 && lastCell && typeof lastCell === 'number' && lastCell > 100 && lastCell < 50000) {
        squareFootage = lastCell;
      }

      // RCD — first month column (2–13) where value > 0, using actual header labels
      const rcd = this.extractRcdFromRow(row as any[], headerLabels);
      
      results.set(tenant.suiteId, { baseRentMonth, squareFootage, rcd, monthlyPayments });
    }
    
    return results;
  }

  /**
   * Extract data from CAM Recovery section
   */
  private static extractFromCAMSection(worksheet: any, tenantInfo: TenantRowInfo[]): Map<string, number> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const results = new Map<string, number>();
    
    for (const tenant of tenantInfo) {
      if (!tenant.section.includes('CAM')) continue;
      
      const row = data[tenant.rowIndex];
      if (!row) continue;
      
      // Extract CAM amount (look for monthly values in columns 7-13)
      let camMonth = 0;
      for (let i = 7; i <= 13; i++) {
        const cell = row[i];
        if (cell && typeof cell === 'number' && cell > 0) {
          camMonth = cell;
          break;
        }
      }
      
      results.set(tenant.suiteId, camMonth);
    }
    
    return results;
  }

  /**
   * Extract data from INS Recovery section
   */
  private static extractFromINSSection(worksheet: any, tenantInfo: TenantRowInfo[]): Map<string, number> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const results = new Map<string, number>();
    
    for (const tenant of tenantInfo) {
      if (!tenant.section.includes('INS')) continue;
      
      const row = data[tenant.rowIndex];
      if (!row) continue;
      
      // Extract INS amount (look for monthly values in columns 7-13)
      let insMonth = 0;
      for (let i = 7; i <= 13; i++) {
        const cell = row[i];
        if (cell && typeof cell === 'number' && cell > 0) {
          insMonth = cell;
          break;
        }
      }
      
      results.set(tenant.suiteId, insMonth);
    }
    
    return results;
  }

  /**
   * Extract data from RET Recovery section
   */
  private static extractFromRETSection(worksheet: any, tenantInfo: TenantRowInfo[]): Map<string, number> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const results = new Map<string, number>();
    
    for (const tenant of tenantInfo) {
      if (!tenant.section.includes('RET')) continue;
      
      const row = data[tenant.rowIndex];
      if (!row) continue;
      
      // Extract RET amount (look for monthly values in columns 7-13)
      let taxMonth = 0;
      for (let i = 7; i <= 13; i++) {
        const cell = row[i];
        if (cell && typeof cell === 'number' && cell > 0) {
          taxMonth = cell;
          break;
        }
      }
      
      results.set(tenant.suiteId, taxMonth);
    }
    
    return results;
  }

  /**
   * Extract data from Tenant Improvements section
   */
  private static extractFromTISection(worksheet: any, tenantInfo: TenantRowInfo[]): Map<string, number> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const results = new Map<string, number>();
    
    for (const tenant of tenantInfo) {
      if (!tenant.section.includes('Tenant Improvements') && !tenant.section.includes('TI')) continue;
      
      const row = data[tenant.rowIndex];
      if (!row) continue;
      
      // Extract TI amount (look for values in column 7)
      let tiAmount = 0;
      const cell = row[7];
      if (cell && typeof cell === 'number' && cell > 0) {
        tiAmount = cell;
      }
      
      results.set(tenant.suiteId, tiAmount);
    }
    
    return results;
  }

  /**
   * Extract data from Leasing Commission section
   */
  private static extractFromLeasingCommissionSection(worksheet: any, tenantInfo: TenantRowInfo[]): Map<string, any> {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const results = new Map<string, any>();
    
    // Look for "Leasing Commission for XXXX - Proposed" rows
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      
      const cellValue = row[0].toString();
      if (cellValue.includes('Leasing Commission for') && cellValue.includes('- Proposed')) {
        // Extract suite ID from the commission row
        const match = cellValue.match(/Leasing Commission for (\d+) - Proposed/);
        if (match) {
          const suiteId = match[1];
          
          // Extract monthly payments for all 12 months (columns 2-13)
          const monthlyPayments = {
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
            dec: 0
          };
          
          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];
          for (let j = 0; j < 12 && j + 2 < row.length; j++) {
            const cell = row[j + 2]; // Start from column 2
            if (cell && typeof cell === 'number') {
              monthlyPayments[months[j]] = cell;
            }
          }
          
          results.set(suiteId, monthlyPayments);
        }
      }
    }
    
    return results;
  }

  /**
   * Calculate base rent per square foot (annual)
   */
  private static calculateBaseRentPerSf(baseRentMonth: number, squareFootage: number): number {
    if (squareFootage === 0 || baseRentMonth === 0) return 0;
    
    const baseRentPerSf = (baseRentMonth * 12) / squareFootage;
    return Math.round(baseRentPerSf * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate total due per month
   */
  private static calculateTotalDueMonth(baseRent: number, cam: number, ins: number, tax: number): number {
    const total = (baseRent || 0) + (cam || 0) + (ins || 0) + (tax || 0);
    return Math.round(total * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate TI per square foot
   */
  private static calculateTiPerSf(tiAmount: number, squareFootage: number): number {
    if (squareFootage === 0 || tiAmount === 0) return 0;
    
    const tiPerSf = tiAmount / squareFootage;
    return Math.round(tiPerSf * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Validate extracted data and log warnings for unusual values
   */
  private static validateExtractedData(suiteData: ExcelSuiteData, logs: string[]): string[] {
    const errors: string[] = [];
    
    // Validate required fields
    if (!suiteData.propertyId || suiteData.propertyId === 'UNKNOWN') {
      errors.push(`Missing or invalid property ID for suite ${suiteData.suiteId}`);
    }
    
    if (!suiteData.suiteId) {
      errors.push('Missing suite ID');
    }
    
    // Validate numeric fields
    const numericFields = [
      'squareFootage', 'baseRentMonth', 'baseRentPerSf', 
      'camMonth', 'insMonth', 'taxMonth', 'totalDueMonth', 'tiPerSf'
    ];
    
    for (const field of numericFields) {
      const value = suiteData[field];
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`Invalid numeric value for ${field}: ${value}`);
      }
    }
    
    // Range validation with warnings
    if (suiteData.squareFootage > 0 && suiteData.squareFootage < 100) {
      logs.push(`Warning: Unusually small square footage: ${suiteData.squareFootage}`);
    }
    
    if (suiteData.baseRentPerSf > 50) {
      logs.push(`Warning: Unusually high base rent per SF: ${suiteData.baseRentPerSf}`);
    }
    
    if (suiteData.tiPerSf > 100) {
      logs.push(`Warning: Unusually high TI per SF: ${suiteData.tiPerSf}`);
    }
    
    return errors;
  }

  /**
   * Determine RCD (Rent Commencement Date) from a Proposed (BRR) row.
   * Scans columns 2–13 and returns the first month where value > 0,
   * formatted as MM/YY (e.g. "06/26") matching the sheet header labels.
   * Falls back to null if all values are zero.
   */
  private static extractRcdFromRow(row: any[], headerLabels?: string[]): string | null {
    // Default month labels for 2026 budget — overridden by actual header if provided
    const defaultLabels = [
      '01/26', '02/26', '03/26', '04/26', '05/26', '06/26',
      '07/26', '08/26', '09/26', '10/26', '11/26', '12/26',
    ];
    const labels = headerLabels && headerLabels.length === 12 ? headerLabels : defaultLabels;

    for (let i = 0; i < 12; i++) {
      const cell = row[i + 2]; // columns 2–13
      const val = typeof cell === 'number'
        ? cell
        : parseFloat(String(cell ?? '').replace(/,/g, ''));
      if (!isNaN(val) && val > 0) {
        return labels[i]; // e.g. "06/26"
      }
    }
    return null;
  }

  /**
   * Enhanced extraction method that returns ExcelSuiteData format
   */
  static extractEnhancedBudgetData(buffer: Buffer): ExcelExtractionResult {
    const logs: string[] = [];
    const errors: string[] = [];
    const suites: ExcelSuiteData[] = [];

    try {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        return {
          success: false,
          suites: [],
          extractionLogs: logs,
          errors: ['No worksheet found in Excel file']
        };
      }

      logs.push(`Processing worksheet: ${sheetName}`);

      // Multi-pass extraction strategy
      
      // 1. Discovery Pass: Find all tenant rows
      const tenantRows = this.findTenantRows(worksheet);
      logs.push(`Found ${tenantRows.length} tenant rows`);

      if (tenantRows.length === 0) {
        return {
          success: false,
          suites: [],
          extractionLogs: logs,
          errors: ['No tenant data found in Excel file']
        };
      }

      // Filter to only Proposed units
      const proposedTenants = tenantRows.filter(t => t.tenantName.toLowerCase().includes('proposed'));
      logs.push(`Found ${proposedTenants.length} proposed tenant rows out of ${tenantRows.length} total`);

      if (proposedTenants.length === 0) {
        return {
          success: false,
          suites: [],
          extractionLogs: logs,
          errors: ['No proposed units found in Excel file']
        };
      }

      // Fill in missing property IDs from other tenant rows
      const knownPropertyId = tenantRows.find(t => t.propertyId !== 'UNKNOWN')?.propertyId;
      if (knownPropertyId) {
        proposedTenants.forEach(tenant => {
          if (tenant.propertyId === 'UNKNOWN') {
            tenant.propertyId = knownPropertyId;
          }
        });
      }

      // 2. Extraction Pass: Process each section (pass all tenantRows for section context, but only use proposedTenants for building suites)
      const rentalIncomeData = this.extractFromRentalIncomeSection(worksheet, proposedTenants);
      const camData = this.extractFromCAMSection(worksheet, proposedTenants);
      const insData = this.extractFromINSSection(worksheet, proposedTenants);
      const retData = this.extractFromRETSection(worksheet, proposedTenants);
      const tiData = this.extractFromTISection(worksheet, proposedTenants);

      // 3. Calculation Pass: Build suite data (proposed only)
      const suiteMap = new Map<string, ExcelSuiteData>();

      for (const tenant of proposedTenants) {
        const suiteId = tenant.suiteId;
        
        if (!suiteMap.has(suiteId)) {
          // Get base data
          const rentalData = rentalIncomeData.get(suiteId) || { baseRentMonth: 0, squareFootage: 0, rcd: null, monthlyPayments: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sept: 0, oct: 0, nov: 0, dec: 0 } };
          const camMonth = camData.get(suiteId) || 0;
          const insMonth = insData.get(suiteId) || 0;
          const taxMonth = retData.get(suiteId) || 0;
          const tiAmount = tiData.get(suiteId) || 0;

          // Calculate derived values
          const baseRentPerSf = this.calculateBaseRentPerSf(rentalData.baseRentMonth, rentalData.squareFootage);
          const totalDueMonth = this.calculateTotalDueMonth(rentalData.baseRentMonth, camMonth, insMonth, taxMonth);
          const tiPerSf = this.calculateTiPerSf(tiAmount, rentalData.squareFootage);

          const suiteData: ExcelSuiteData = {
            propertyId: tenant.propertyId,
            suiteId: tenant.suiteId,
            status: 'Proposed',
            squareFootage: rentalData.squareFootage,
            baseRentMonth: rentalData.baseRentMonth,
            baseRentPerSf,
            camMonth,
            insMonth,
            taxMonth,
            totalDueMonth,
            tiPerSf,
            rcd: rentalData.rcd ?? null,
            monthlyPayments: rentalData.monthlyPayments,
          };

          suiteMap.set(suiteId, suiteData);
        }
      }

      // 4. Validation Pass: Validate all suite data
      suiteMap.forEach((suiteData, suiteId) => {
        const validationErrors = this.validateExtractedData(suiteData, logs);
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
        } else {
          suites.push(suiteData);
        }
      });

      logs.push(`Successfully extracted ${suites.length} suites`);

      return {
        success: suites.length > 0,
        suites,
        extractionLogs: logs,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      errors.push(`Excel parsing failed: ${errorMessage}`);
      
      return {
        success: false,
        suites: [],
        extractionLogs: logs,
        errors
      };
    }
  }
}