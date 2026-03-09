import { Test, TestingModule } from '@nestjs/testing';
import { ForeSightPdfExtractorService } from './foresight-pdf-extractor.service';

describe('ForeSightPdfExtractorService', () => {
  let service: ForeSightPdfExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ForeSightPdfExtractorService],
    }).compile();

    service = module.get<ForeSightPdfExtractorService>(ForeSightPdfExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractPropertyId', () => {
    it('should extract property ID from suite identifier', () => {
      const text = 'Suite: 123456-001';
      const logs: string[] = [];
      
      const result = service['extractPropertyId'](text, logs);
      
      expect(result).toBe('123456');
      expect(logs).toContain('Property ID extracted from suite identifier: 123456');
    });

    it('should extract property ID from multiple suite identifiers', () => {
      const text = 'Suite: 123456-001, Suite: 123456-002';
      const logs: string[] = [];
      
      const result = service['extractPropertyId'](text, logs);
      
      expect(result).toBe('123456');
      expect(logs).toContain('Property ID extracted from suite identifier: 123456');
    });

    it('should return UNKNOWN when property ID is not found', () => {
      const text = 'No suite identifier here';
      const logs: string[] = [];
      
      const result = service['extractPropertyId'](text, logs);
      
      expect(result).toBe('UNKNOWN');
      expect(logs).toContain('Property ID not found, using default');
    });

    it('should handle empty text', () => {
      const text = '';
      const logs: string[] = [];
      
      const result = service['extractPropertyId'](text, logs);
      
      expect(result).toBe('UNKNOWN');
      expect(logs).toContain('Property ID not found, using default');
    });

    it('should extract property ID from different formats', () => {
      const text = 'Property 999888-777';
      const logs: string[] = [];
      
      const result = service['extractPropertyId'](text, logs);
      
      expect(result).toBe('999888');
    });
  });

  describe('extractPropertyName', () => {
    it('should extract property name from text', () => {
      const text = 'Property Name: Sunset Plaza';
      const logs: string[] = [];
      
      const result = service['extractPropertyName'](text, logs);
      
      expect(result).toBe('Sunset Plaza');
      expect(logs).toContain('Property name extracted: Sunset Plaza');
    });

    it('should trim whitespace from property name', () => {
      const text = 'Property Name:   Sunset Plaza   ';
      const logs: string[] = [];
      
      const result = service['extractPropertyName'](text, logs);
      
      expect(result).toBe('Sunset Plaza');
    });

    it('should handle property names with special characters', () => {
      const text = 'Property Name: The Plaza @ Main St.';
      const logs: string[] = [];
      
      const result = service['extractPropertyName'](text, logs);
      
      expect(result).toBe('The Plaza @ Main St.');
    });

    it('should return UNKNOWN when property name is not found', () => {
      const text = 'No property name here';
      const logs: string[] = [];
      
      const result = service['extractPropertyName'](text, logs);
      
      expect(result).toBe('UNKNOWN');
      expect(logs).toContain('Property name not found');
    });

    it('should handle empty text', () => {
      const text = '';
      const logs: string[] = [];
      
      const result = service['extractPropertyName'](text, logs);
      
      expect(result).toBe('UNKNOWN');
      expect(logs).toContain('Property name not found');
    });

    it('should extract property name up to newline', () => {
      const text = 'Property Name: Sunset Plaza\nOther info';
      const logs: string[] = [];
      
      const result = service['extractPropertyName'](text, logs);
      
      expect(result).toBe('Sunset Plaza');
    });
  });

  describe('extractRegion', () => {
    it('should extract region code from text', () => {
      const text = 'Region: CA';
      const logs: string[] = [];
      
      const result = service['extractRegion'](text, logs);
      
      expect(result).toBe('CA');
      expect(logs).toContain('Region extracted: CA');
    });

    it('should extract region code with whitespace', () => {
      const text = 'Region:   TX  ';
      const logs: string[] = [];
      
      const result = service['extractRegion'](text, logs);
      
      expect(result).toBe('TX');
    });

    it('should only match 2-letter uppercase codes', () => {
      const text = 'Region: NY';
      const logs: string[] = [];
      
      const result = service['extractRegion'](text, logs);
      
      expect(result).toBe('NY');
    });

    it('should return UNKNOWN when region is not found', () => {
      const text = 'No region here';
      const logs: string[] = [];
      
      const result = service['extractRegion'](text, logs);
      
      expect(result).toBe('UNKNOWN');
      expect(logs).toContain('Region not found');
    });

    it('should handle empty text', () => {
      const text = '';
      const logs: string[] = [];
      
      const result = service['extractRegion'](text, logs);
      
      expect(result).toBe('UNKNOWN');
      expect(logs).toContain('Region not found');
    });

    it('should not match lowercase region codes', () => {
      const text = 'Region: ca';
      const logs: string[] = [];
      
      const result = service['extractRegion'](text, logs);
      
      expect(result).toBe('UNKNOWN');
    });

    it('should extract first 2 letters from 3-letter codes', () => {
      const text = 'Region: USA';
      const logs: string[] = [];
      
      const result = service['extractRegion'](text, logs);
      
      // The regex matches the first 2 uppercase letters
      expect(result).toBe('US');
    });
  });

  describe('extractSuiteIdentifiers', () => {
    it('should extract single suite identifier', () => {
      const text = 'Suite: 123456-001';
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual(['123456-001']);
      expect(logs).toContain('Found 1 unique suite identifiers');
    });

    it('should extract multiple suite identifiers', () => {
      const text = 'Suite: 123456-001, Suite: 123456-002, Suite: 123456-003';
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual(['123456-001', '123456-002', '123456-003']);
      expect(logs).toContain('Found 3 unique suite identifiers');
    });

    it('should return unique identifiers only', () => {
      const text = 'Suite: 123456-001, Suite: 123456-001, Suite: 123456-002';
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual(['123456-001', '123456-002']);
      expect(logs).toContain('Found 2 unique suite identifiers');
    });

    it('should handle identifiers in different formats', () => {
      const text = 'Property 999888-777 and 888777-666';
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual(['999888-777', '888777-666']);
      expect(logs).toContain('Found 2 unique suite identifiers');
    });

    it('should return empty array when no identifiers found', () => {
      const text = 'No suite identifiers here';
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual([]);
      expect(logs).toContain('Found 0 unique suite identifiers');
    });

    it('should handle empty text', () => {
      const text = '';
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual([]);
      expect(logs).toContain('Found 0 unique suite identifiers');
    });

    it('should match PPPPPP-SSS format exactly', () => {
      const text = 'Valid: 123456-789, Invalid: 12345-789, Invalid: 123456-78, Invalid: 1234567-890';
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual(['123456-789', '234567-890']);
      expect(logs).toContain('Found 2 unique suite identifiers');
    });

    it('should extract identifiers from multiline text', () => {
      const text = `
        Suite: 123456-001
        Property: 123456-002
        Unit: 123456-003
      `;
      const logs: string[] = [];
      
      const result = service['extractSuiteIdentifiers'](text, logs);
      
      expect(result).toEqual(['123456-001', '123456-002', '123456-003']);
      expect(logs).toContain('Found 3 unique suite identifiers');
    });
  });

  describe('extractBaseRent', () => {
    it('should extract base rent for a suite', () => {
      const text = '123456-001 Rental Income BRR $1,234.56';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(1234.56);
      expect(logs).toContain('Base Rent for 123456-001: 1234.56');
    });

    it('should extract base rent without dollar sign', () => {
      const text = '123456-001 Rental Income BRR 2500.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(2500);
      expect(logs).toContain('Base Rent for 123456-001: 2500');
    });

    it('should extract base rent with commas', () => {
      const text = '123456-001 Rental Income BRR $10,500.75';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(10500.75);
      expect(logs).toContain('Base Rent for 123456-001: 10500.75');
    });

    it('should return 0 when base rent is not found', () => {
      const text = '123456-001 Some other data';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Base Rent not found for 123456-001, using 0');
    });

    it('should handle empty text', () => {
      const text = '';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Base Rent not found for 123456-001, using 0');
    });

    it('should extract base rent from multiline text', () => {
      const text = `
        123456-001
        Rental Income BRR
        $3,750.00
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(3750);
      expect(logs).toContain('Base Rent for 123456-001: 3750');
    });

    it('should only extract base rent for the specified suite', () => {
      const text = `
        123456-001 Rental Income BRR $1,000.00
        123456-002 Rental Income BRR $2,000.00
      `;
      const identifier = '123456-002';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(2000);
      expect(logs).toContain('Base Rent for 123456-002: 2000');
    });

    it('should handle base rent with no decimal places', () => {
      const text = '123456-001 Rental Income BRR $5000';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(5000);
      expect(logs).toContain('Base Rent for 123456-001: 5000');
    });

    it('should handle base rent with extra whitespace', () => {
      const text = '123456-001   Rental Income BRR   $  1,500.50';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(1500.5);
      expect(logs).toContain('Base Rent for 123456-001: 1500.5');
    });

    it('should handle zero base rent', () => {
      const text = '123456-001 Rental Income BRR $0.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractBaseRent'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Base Rent for 123456-001: 0');
    });
  });

  describe('extractCAM', () => {
    it('should extract CAM for a suite', () => {
      const text = '123456-001 CAM Recovery - Billed $500.25';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(500.25);
      expect(logs).toContain('CAM for 123456-001: 500.25');
    });

    it('should extract CAM without dollar sign', () => {
      const text = '123456-001 CAM Recovery - Billed 750.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(750);
      expect(logs).toContain('CAM for 123456-001: 750');
    });

    it('should extract CAM with commas', () => {
      const text = '123456-001 CAM Recovery - Billed $1,250.50';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(1250.5);
      expect(logs).toContain('CAM for 123456-001: 1250.5');
    });

    it('should return 0 when CAM is not found', () => {
      const text = '123456-001 Some other data';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('CAM not found for 123456-001, using 0');
    });

    it('should handle empty text', () => {
      const text = '';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('CAM not found for 123456-001, using 0');
    });

    it('should extract CAM from multiline text', () => {
      const text = `
        123456-001
        CAM Recovery - Billed
        $425.75
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(425.75);
      expect(logs).toContain('CAM for 123456-001: 425.75');
    });

    it('should only extract CAM for the specified suite', () => {
      const text = `
        123456-001 CAM Recovery - Billed $300.00
        123456-002 CAM Recovery - Billed $600.00
      `;
      const identifier = '123456-002';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(600);
      expect(logs).toContain('CAM for 123456-002: 600');
    });

    it('should handle CAM with no decimal places', () => {
      const text = '123456-001 CAM Recovery - Billed $850';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(850);
      expect(logs).toContain('CAM for 123456-001: 850');
    });

    it('should handle CAM with extra whitespace', () => {
      const text = '123456-001   CAM Recovery - Billed   $  950.25';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(950.25);
      expect(logs).toContain('CAM for 123456-001: 950.25');
    });

    it('should handle zero CAM', () => {
      const text = '123456-001 CAM Recovery - Billed $0.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('CAM for 123456-001: 0');
    });

    it('should handle large CAM amounts', () => {
      const text = '123456-001 CAM Recovery - Billed $10,500.99';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractCAM'](text, identifier, logs);
      
      expect(result).toBe(10500.99);
      expect(logs).toContain('CAM for 123456-001: 10500.99');
    });
  });

  describe('extractInsurance', () => {
    it('should extract insurance for a suite', () => {
      const text = '123456-001 INS Recovery - Billed $250.50';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(250.50);
      expect(logs).toContain('Insurance for 123456-001: 250.5');
    });

    it('should extract insurance without dollar sign', () => {
      const text = '123456-001 INS Recovery - Billed 350.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(350);
      expect(logs).toContain('Insurance for 123456-001: 350');
    });

    it('should extract insurance with commas', () => {
      const text = '123456-001 INS Recovery - Billed $1,125.75';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(1125.75);
      expect(logs).toContain('Insurance for 123456-001: 1125.75');
    });

    it('should return 0 when insurance is not found', () => {
      const text = '123456-001 Some other data';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Insurance not found for 123456-001, using 0');
    });

    it('should handle empty text', () => {
      const text = '';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Insurance not found for 123456-001, using 0');
    });

    it('should extract insurance from multiline text', () => {
      const text = `
        123456-001
        INS Recovery - Billed
        $175.25
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(175.25);
      expect(logs).toContain('Insurance for 123456-001: 175.25');
    });

    it('should only extract insurance for the specified suite', () => {
      const text = `
        123456-001 INS Recovery - Billed $200.00
        123456-002 INS Recovery - Billed $400.00
      `;
      const identifier = '123456-002';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(400);
      expect(logs).toContain('Insurance for 123456-002: 400');
    });

    it('should handle insurance with no decimal places', () => {
      const text = '123456-001 INS Recovery - Billed $500';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(500);
      expect(logs).toContain('Insurance for 123456-001: 500');
    });

    it('should handle zero insurance', () => {
      const text = '123456-001 INS Recovery - Billed $0.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractInsurance'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Insurance for 123456-001: 0');
    });
  });

  describe('extractTax', () => {
    it('should extract tax for a suite', () => {
      const text = '123456-001 RET Recovery - Billed $300.75';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(300.75);
      expect(logs).toContain('Tax for 123456-001: 300.75');
    });

    it('should extract tax without dollar sign', () => {
      const text = '123456-001 RET Recovery - Billed 450.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(450);
      expect(logs).toContain('Tax for 123456-001: 450');
    });

    it('should extract tax with commas', () => {
      const text = '123456-001 RET Recovery - Billed $2,250.50';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(2250.50);
      expect(logs).toContain('Tax for 123456-001: 2250.5');
    });

    it('should return 0 when tax is not found', () => {
      const text = '123456-001 Some other data';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Tax not found for 123456-001, using 0');
    });

    it('should handle empty text', () => {
      const text = '';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Tax not found for 123456-001, using 0');
    });

    it('should extract tax from multiline text', () => {
      const text = `
        123456-001
        RET Recovery - Billed
        $225.50
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(225.50);
      expect(logs).toContain('Tax for 123456-001: 225.5');
    });

    it('should only extract tax for the specified suite', () => {
      const text = `
        123456-001 RET Recovery - Billed $300.00
        123456-002 RET Recovery - Billed $600.00
      `;
      const identifier = '123456-002';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(600);
      expect(logs).toContain('Tax for 123456-002: 600');
    });

    it('should handle tax with no decimal places', () => {
      const text = '123456-001 RET Recovery - Billed $750';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(750);
      expect(logs).toContain('Tax for 123456-001: 750');
    });

    it('should handle zero tax', () => {
      const text = '123456-001 RET Recovery - Billed $0.00';
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractTax'](text, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Tax for 123456-001: 0');
    });
  });

  describe('calculateTotalDueMonth', () => {
    it('should calculate total due as sum of all charges', () => {
      const baseRent = 1000;
      const cam = 200;
      const ins = 150;
      const tax = 250;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(result).toBe(1600);
      expect(logs).toContain('Calculated Total Due/Month for suite 123456-001: 1600 (Base Rent: 1000 + CAM: 200 + INS: 150 + TAX: 250)');
    });

    it('should handle missing values as 0', () => {
      const baseRent = 1000;
      const cam = 0;
      const ins = 0;
      const tax = 0;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(result).toBe(1000);
      expect(logs).toContain('Calculated Total Due/Month for suite 123456-001: 1000 (Base Rent: 1000 + CAM: 0 + INS: 0 + TAX: 0)');
    });

    it('should handle all zero values', () => {
      const baseRent = 0;
      const cam = 0;
      const ins = 0;
      const tax = 0;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(result).toBe(0);
      expect(logs).toContain('Calculated Total Due/Month for suite 123456-001: 0 (Base Rent: 0 + CAM: 0 + INS: 0 + TAX: 0)');
    });

    it('should handle decimal values correctly', () => {
      const baseRent = 1234.56;
      const cam = 500.25;
      const ins = 250.50;
      const tax = 300.75;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(result).toBe(2286.06);
      expect(logs).toContain('Calculated Total Due/Month for suite 123456-001: 2286.06 (Base Rent: 1234.56 + CAM: 500.25 + INS: 250.5 + TAX: 300.75)');
    });

    it('should handle large values', () => {
      const baseRent = 10000;
      const cam = 2500;
      const ins = 1500;
      const tax = 3000;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(result).toBe(17000);
      expect(logs).toContain('Calculated Total Due/Month for suite 123456-001: 17000 (Base Rent: 10000 + CAM: 2500 + INS: 1500 + TAX: 3000)');
    });

    it('should handle only base rent', () => {
      const baseRent = 2500;
      const cam = 0;
      const ins = 0;
      const tax = 0;
      const identifier = '123456-002';
      const logs: string[] = [];
      
      const result = service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(result).toBe(2500);
      expect(logs).toContain('Calculated Total Due/Month for suite 123456-002: 2500 (Base Rent: 2500 + CAM: 0 + INS: 0 + TAX: 0)');
    });

    it('should handle partial charges', () => {
      const baseRent = 1500;
      const cam = 300;
      const ins = 0;
      const tax = 200;
      const identifier = '123456-003';
      const logs: string[] = [];
      
      const result = service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(result).toBe(2000);
      expect(logs).toContain('Calculated Total Due/Month for suite 123456-003: 2000 (Base Rent: 1500 + CAM: 300 + INS: 0 + TAX: 200)');
    });

    it('should log calculation formula', () => {
      const baseRent = 1000;
      const cam = 200;
      const ins = 150;
      const tax = 250;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      service['calculateTotalDueMonth'](baseRent, cam, ins, tax, identifier, logs);
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toMatch(/Calculated Total Due\/Month for suite 123456-001: \d+/);
      expect(logs[0]).toContain('Base Rent: 1000');
      expect(logs[0]).toContain('CAM: 200');
      expect(logs[0]).toContain('INS: 150');
      expect(logs[0]).toContain('TAX: 250');
    });
  });

  describe('extractSuiteData', () => {
    it('should extract complete suite data with all charges', () => {
      const text = `
        123456-001 Rental Income BRR $1,500.00
        123456-001 CAM Recovery - Billed $300.00
        123456-001 INS Recovery - Billed $150.00
        123456-001 RET Recovery - Billed $250.00
        123456-001 Jan $2,200.00
        123456-001 Feb $2,200.00
        123456-001 Mar $2,200.00
        123456-001 Apr $2,200.00
        123456-001 May $2,200.00
        123456-001 Jun $2,200.00
        123456-001 Jul $2,200.00
        123456-001 Aug $2,200.00
        123456-001 Sept $2,200.00
        123456-001 Oct $2,200.00
        123456-001 Nov $2,200.00
        123456-001 Dec $2,200.00
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractSuiteData'](text, identifier, logs);
      
      expect(result.suiteId).toBe('001');
      expect(result.charges.baseRentMonth).toBe(1500);
      expect(result.charges.camMonth).toBe(300);
      expect(result.charges.insMonth).toBe(150);
      expect(result.charges.taxMonth).toBe(250);
      expect(result.charges.totalDueMonth).toBe(2200);
      expect(result.balanceDue).toBe(0);
      expect(result.leaseTerms.rentDueDate).toBeNull();
      expect(result.leaseTerms.lateAfter).toBeNull();
      expect(result.leaseTerms.lateFee).toBe(0);
      expect(result.monthlyPayments.jan).toBe(2200);
      expect(result.monthlyPayments.dec).toBe(2200);
      expect(logs).toContain('Extracting data for suite: 001');
      expect(logs).toContain('Completed extraction for suite: 001');
    });

    it('should handle missing charges with default values', () => {
      const text = `
        123456-002 Rental Income BRR $2,000.00
      `;
      const identifier = '123456-002';
      const logs: string[] = [];
      
      const result = service['extractSuiteData'](text, identifier, logs);
      
      expect(result.suiteId).toBe('002');
      expect(result.charges.baseRentMonth).toBe(2000);
      expect(result.charges.camMonth).toBe(0);
      expect(result.charges.insMonth).toBe(0);
      expect(result.charges.taxMonth).toBe(0);
      expect(result.charges.totalDueMonth).toBe(2000);
      expect(result.balanceDue).toBe(0);
      expect(result.leaseTerms.rentDueDate).toBeNull();
      expect(result.leaseTerms.lateAfter).toBeNull();
      expect(result.leaseTerms.lateFee).toBe(0);
    });

    it('should set default values for lease terms', () => {
      const text = `
        999888-777 Rental Income BRR $3,000.00
      `;
      const identifier = '999888-777';
      const logs: string[] = [];
      
      const result = service['extractSuiteData'](text, identifier, logs);
      
      expect(result.leaseTerms.rentDueDate).toBeNull();
      expect(result.leaseTerms.lateAfter).toBeNull();
      expect(result.leaseTerms.lateFee).toBe(0);
    });

    it('should extract suite ID from identifier correctly', () => {
      const text = `
        123456-999 Rental Income BRR $1,000.00
      `;
      const identifier = '123456-999';
      const logs: string[] = [];
      
      const result = service['extractSuiteData'](text, identifier, logs);
      
      expect(result.suiteId).toBe('999');
    });

    it('should include all monthly payments', () => {
      const text = `
        123456-001 Rental Income BRR $1,000.00
        123456-001 Jan $1,000.00
        123456-001 Feb $1,100.00
        123456-001 Mar $1,200.00
        123456-001 Apr $1,300.00
        123456-001 May $1,400.00
        123456-001 Jun $1,500.00
        123456-001 Jul $1,600.00
        123456-001 Aug $1,700.00
        123456-001 Sept $1,800.00
        123456-001 Oct $1,900.00
        123456-001 Nov $2,000.00
        123456-001 Dec $2,100.00
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractSuiteData'](text, identifier, logs);
      
      expect(result.monthlyPayments.jan).toBe(1000);
      expect(result.monthlyPayments.feb).toBe(1100);
      expect(result.monthlyPayments.mar).toBe(1200);
      expect(result.monthlyPayments.apr).toBe(1300);
      expect(result.monthlyPayments.may).toBe(1400);
      expect(result.monthlyPayments.jun).toBe(1500);
      expect(result.monthlyPayments.jul).toBe(1600);
      expect(result.monthlyPayments.aug).toBe(1700);
      expect(result.monthlyPayments.sept).toBe(1800);
      expect(result.monthlyPayments.oct).toBe(1900);
      expect(result.monthlyPayments.nov).toBe(2000);
      expect(result.monthlyPayments.dec).toBe(2100);
    });

    it('should handle missing monthly payments with 0', () => {
      const text = `
        123456-001 Rental Income BRR $1,000.00
        123456-001 Jan $1,000.00
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractSuiteData'](text, identifier, logs);
      
      expect(result.monthlyPayments.jan).toBe(1000);
      expect(result.monthlyPayments.feb).toBe(0);
      expect(result.monthlyPayments.mar).toBe(0);
      expect(result.monthlyPayments.dec).toBe(0);
    });

    it('should log extraction start and completion', () => {
      const text = `
        123456-001 Rental Income BRR $1,000.00
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      service['extractSuiteData'](text, identifier, logs);
      
      expect(logs).toContain('Extracting data for suite: 001');
      expect(logs).toContain('Completed extraction for suite: 001');
    });

    it('should calculate total due correctly', () => {
      const text = `
        123456-001 Rental Income BRR $1,000.00
        123456-001 CAM Recovery - Billed $200.00
        123456-001 INS Recovery - Billed $100.00
        123456-001 RET Recovery - Billed $150.00
      `;
      const identifier = '123456-001';
      const logs: string[] = [];
      
      const result = service['extractSuiteData'](text, identifier, logs);
      
      expect(result.charges.totalDueMonth).toBe(1450);
      expect(logs.some(log => log.includes('Calculated Total Due/Month for suite 123456-001: 1450'))).toBe(true);
    });
  });

  describe('extractFinancialData', () => {
    it('should extract complete financial data from PDF buffer', async () => {
      // Create a mock PDF buffer with sample data
      const mockPdfText = `
        Property Name: Downtown Plaza
        Region: CA
        123456-001 Rental Income BRR $1,000.00
        123456-001 CAM Recovery - Billed $200.00
        123456-001 INS Recovery - Billed $100.00
        123456-001 RET Recovery - Billed $150.00
        123456-001 Jan $1,450.00
        123456-001 Feb $1,450.00
        123456-001 Mar $1,450.00
        123456-001 Apr $1,450.00
        123456-001 May $1,450.00
        123456-001 Jun $1,450.00
        123456-001 Jul $1,450.00
        123456-001 Aug $1,450.00
        123456-001 Sept $1,450.00
        123456-001 Oct $1,450.00
        123456-001 Nov $1,450.00
        123456-001 Dec $1,450.00
      `;

      // Mock PdfParserUtil.parsePdf
      const PdfParserUtil = require('./utils/pdf-parser.util').PdfParserUtil;
      jest.spyOn(PdfParserUtil, 'parsePdf').mockResolvedValue(mockPdfText);

      const mockBuffer = Buffer.from('mock pdf content');
      const result = await service.extractFinancialData(mockBuffer);

      expect(result).toBeDefined();
      expect(result.propertyId).toBe('123456');
      expect(result.propertyName).toBe('Downtown Plaza');
      expect(result.region).toBe('CA');
      expect(result.suites).toHaveLength(1);
      expect(result.suites[0].suiteId).toBe('001');
      expect(result.suites[0].charges.baseRentMonth).toBe(1000);
      expect(result.suites[0].charges.camMonth).toBe(200);
      expect(result.suites[0].charges.insMonth).toBe(100);
      expect(result.suites[0].charges.taxMonth).toBe(150);
      expect(result.suites[0].charges.totalDueMonth).toBe(1450);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.extractionLogs).toContain('PDF parsed successfully');
      expect(result.extractionLogs.length).toBeGreaterThan(0);
    });

    it('should handle multiple suites', async () => {
      const mockPdfText = `
        Property Name: Multi Suite Plaza
        Region: TX
        123456-001 Rental Income BRR $1,000.00
        123456-001 CAM Recovery - Billed $200.00
        123456-002 Rental Income BRR $2,000.00
        123456-002 CAM Recovery - Billed $300.00
      `;

      const PdfParserUtil = require('./utils/pdf-parser.util').PdfParserUtil;
      jest.spyOn(PdfParserUtil, 'parsePdf').mockResolvedValue(mockPdfText);

      const mockBuffer = Buffer.from('mock pdf content');
      const result = await service.extractFinancialData(mockBuffer);

      expect(result.suites).toHaveLength(2);
      expect(result.suites[0].suiteId).toBe('001');
      expect(result.suites[1].suiteId).toBe('002');
      expect(result.propertyId).toBe('123456');
    });

    it('should include extraction logs', async () => {
      const mockPdfText = `
        Property Name: Test Plaza
        Region: NY
        123456-001 Rental Income BRR $1,000.00
      `;

      const PdfParserUtil = require('./utils/pdf-parser.util').PdfParserUtil;
      jest.spyOn(PdfParserUtil, 'parsePdf').mockResolvedValue(mockPdfText);

      const mockBuffer = Buffer.from('mock pdf content');
      const result = await service.extractFinancialData(mockBuffer);

      expect(result.extractionLogs).toContain('PDF parsed successfully');
      expect(result.extractionLogs.some(log => log.includes('Property ID extracted'))).toBe(true);
      expect(result.extractionLogs.some(log => log.includes('Property name extracted'))).toBe(true);
      expect(result.extractionLogs.some(log => log.includes('Region extracted'))).toBe(true);
      expect(result.extractionLogs.some(log => log.includes('Found'))).toBe(true);
    });

    it('should handle PDF parsing errors', async () => {
      const PdfParserUtil = require('./utils/pdf-parser.util').PdfParserUtil;
      jest.spyOn(PdfParserUtil, 'parsePdf').mockRejectedValue(new Error('PDF parsing failed'));

      const mockBuffer = Buffer.from('invalid pdf content');

      await expect(service.extractFinancialData(mockBuffer)).rejects.toThrow('PDF parsing failed');
    });

    it('should include timestamps in ISO 8601 format', async () => {
      const mockPdfText = `
        Property Name: Test Plaza
        Region: CA
        123456-001 Rental Income BRR $1,000.00
      `;

      const PdfParserUtil = require('./utils/pdf-parser.util').PdfParserUtil;
      jest.spyOn(PdfParserUtil, 'parsePdf').mockResolvedValue(mockPdfText);

      const mockBuffer = Buffer.from('mock pdf content');
      const result = await service.extractFinancialData(mockBuffer);

      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.createdAt).toBe(result.updatedAt);
    });

    it('should handle suite extraction errors gracefully', async () => {
      const mockPdfText = `
        Property Name: Test Plaza
        Region: CA
        123456-001 Rental Income BRR $1,000.00
        123456-002 Rental Income BRR $2,000.00
      `;

      const PdfParserUtil = require('./utils/pdf-parser.util').PdfParserUtil;
      jest.spyOn(PdfParserUtil, 'parsePdf').mockResolvedValue(mockPdfText);

      // Mock extractSuiteData to throw error for second suite
      const originalExtractSuiteData = service['extractSuiteData'];
      let callCount = 0;
      jest.spyOn(service as any, 'extractSuiteData').mockImplementation((text, identifier, logs) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Suite extraction failed');
        }
        return originalExtractSuiteData.call(service, text, identifier, logs);
      });

      const mockBuffer = Buffer.from('mock pdf content');
      const result = await service.extractFinancialData(mockBuffer);

      // Should still return result with one suite
      expect(result.suites).toHaveLength(1);
      expect(result.extractionLogs.some(log => log.includes('Error extracting data for suite'))).toBe(true);
    });

    it('should handle empty PDF text', async () => {
      const mockPdfText = '';

      const PdfParserUtil = require('./utils/pdf-parser.util').PdfParserUtil;
      jest.spyOn(PdfParserUtil, 'parsePdf').mockResolvedValue(mockPdfText);

      const mockBuffer = Buffer.from('mock pdf content');
      const result = await service.extractFinancialData(mockBuffer);

      expect(result.propertyId).toBe('UNKNOWN');
      expect(result.propertyName).toBe('UNKNOWN');
      expect(result.region).toBe('UNKNOWN');
      expect(result.suites).toHaveLength(0);
      expect(result.extractionLogs).toContain('PDF parsed successfully');
    });
  });
});
