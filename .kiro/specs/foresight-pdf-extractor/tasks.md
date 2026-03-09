# Implementation Plan: ForeSight PDF Extractor

## Overview

This implementation plan breaks down the ForeSight PDF Extractor feature into discrete coding tasks. The feature will be implemented as a NestJS module with TypeScript, following the existing project patterns. The implementation will proceed incrementally, building core utilities first, then the extraction service, then the API layer, with property-based tests integrated throughout to catch errors early.

## Tasks

- [x] 1. Install dependencies and set up module structure
  - Install pdf-parse library: `npm install pdf-parse`
  - Install types: `npm install --save-dev @types/pdf-parse`
  - Create module directory: `src/modules/foresight-pdf-extractor/`
  - Create subdirectories: `dto/`, `interfaces/`, `utils/`
  - Create module file: `foresight-pdf-extractor.module.ts`
  - _Requirements: 14.1_

- [ ] 2. Implement utility classes
  - [x] 2.1 Create NumericCleanerUtil
    - Implement `cleanNumeric()` method to remove currency symbols, commas, whitespace
    - Convert cleaned string to number
    - Return 0 for invalid numbers
    - Create file: `src/modules/foresight-pdf-extractor/utils/numeric-cleaner.util.ts`
    - _Requirements: 4.2, 5.2, 6.2, 7.2, 8.2_
  
  - [ ]* 2.2 Write property test for numeric cleaning
    - **Property 5: Numeric Value Cleaning**
    - Generate random currency strings with $, commas, whitespace
    - Verify all formatting is removed and result is numeric
    - **Validates: Requirements 4.2, 5.2, 6.2, 7.2, 8.2**
  
  - [ ]* 2.3 Write property test for numeric type constraint
    - **Property 6: Numeric Type Constraint**
    - Generate random financial values
    - Verify all results are number type, not string
    - **Validates: Requirements 4.3, 5.3, 6.3, 7.3, 8.3, 9.2, 11.4**
  
  - [x] 2.4 Create PdfParserUtil
    - Implement `parsePdf()` method using pdf-parse library
    - Handle parsing errors with descriptive messages
    - Return extracted text content
    - Create file: `src/modules/foresight-pdf-extractor/utils/pdf-parser.util.ts`
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 2.5 Write property test for PDF parsing success
    - **Property 1: PDF Parsing Success**
    - Generate or use sample valid PDF buffers
    - Verify parsing succeeds without exceptions
    - **Validates: Requirements 1.1**
  
  - [ ]* 2.6 Write property test for PDF parsing error handling
    - **Property 2: PDF Parsing Error Handling**
    - Generate corrupted/invalid buffers
    - Verify descriptive error messages are thrown
    - **Validates: Requirements 1.2**
  
  - [x] 2.7 Create PatternMatcherUtil
    - Implement `findFirst()` method for single regex match
    - Implement `findAll()` method for multiple regex matches
    - Handle null/empty text gracefully
    - Create file: `src/modules/foresight-pdf-extractor/utils/pattern-matcher.util.ts`
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

- [ ] 3. Define TypeScript interfaces and DTOs
  - [x] 3.1 Create interface files
    - Create `FinancialChargesInterface` with baseRentMonth, camMonth, insMonth, taxMonth, totalDueMonth
    - Create `LeaseTermsInterface` with rentDueDate, lateAfter, lateFee
    - Create `MonthlyPaymentsInterface` with jan-dec fields
    - Create `SuiteDataInterface` with suiteId, charges, balanceDue, leaseTerms, monthlyPayments
    - Create `ExtractionLogInterface` for log entries
    - Create files in: `src/modules/foresight-pdf-extractor/interfaces/`
    - _Requirements: 11.1, 11.2_
  
  - [x] 3.2 Create DTO classes with validation
    - Create `FinancialChargesDto` with @IsNumber() decorators
    - Create `LeaseTermsDto` with @IsOptional() and @IsNumber() decorators
    - Create `MonthlyPaymentsDto` with @IsNumber() decorators for all 12 months
    - Create `SuiteDataDto` with @IsString(), @ValidateNested() decorators
    - Create `ExtractionResultDto` with @IsString(), @IsArray(), @ValidateNested() decorators
    - Create files in: `src/modules/foresight-pdf-extractor/dto/`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 3.3 Write property test for JSON structure completeness
    - **Property 9: JSON Structure Completeness**
    - Generate extraction results
    - Verify propertyId, propertyName, region, suites, createdAt, updatedAt fields exist
    - **Validates: Requirements 11.1**
  
  - [ ]* 3.4 Write property test for suite structure completeness
    - **Property 10: Suite Structure Completeness**
    - Generate extraction results with suites
    - Verify each suite has suiteId, charges, balanceDue, leaseTerms, monthlyPayments
    - **Validates: Requirements 11.2**
  
  - [ ]* 3.5 Write property test for monthly payments completeness
    - **Property 8: Monthly Payments Completeness**
    - Generate extraction results
    - Verify all 12 month fields exist in monthlyPayments
    - **Validates: Requirements 8.1**

- [ ] 4. Implement ForeSightPdfExtractorService
  - [x] 4.1 Create service class with basic structure
    - Create service file: `src/modules/foresight-pdf-extractor/foresight-pdf-extractor.service.ts`
    - Add @Injectable() decorator
    - Inject Logger
    - Create `extractFinancialData()` main method signature
    - _Requirements: 1.1, 11.1_
  
  - [x] 4.2 Implement property extraction methods
    - Implement `extractPropertyId()` using regex pattern for suite identifiers
    - Implement `extractPropertyName()` using regex pattern
    - Implement `extractRegion()` using regex pattern
    - Add extraction logging for each method
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 4.3 Write property test for suite identifier parsing
    - **Property 3: Suite Identifier Parsing**
    - Generate random identifiers in format "PPPPPP-SSS"
    - Verify correct extraction of property ID and suite ID
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ]* 4.4 Write property test for property ID consistency
    - **Property 4: Property ID Consistency**
    - Generate extraction results with multiple suites
    - Verify all suites have the same property ID
    - **Validates: Requirements 2.4**
  
  - [x] 4.5 Implement suite identifier extraction
    - Implement `extractSuiteIdentifiers()` to find all suite IDs in PDF text
    - Use regex pattern to match "PPPPPP-SSS" format
    - Return unique identifiers only
    - Log count of found identifiers
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 4.6 Write property test for malformed identifier handling
    - **Property 16: Malformed Identifier Handling**
    - Generate malformed identifiers
    - Verify error logging and graceful skipping
    - **Validates: Requirements 3.3, 13.2**

- [ ] 5. Implement financial data extraction methods
  - [x] 5.1 Implement base rent extraction
    - Implement `extractBaseRent()` method
    - Use regex to find "Rental Income BRR" rows for suite
    - Use NumericCleanerUtil to clean extracted value
    - Return 0 if not found
    - Log extraction details
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 5.2 Implement CAM extraction
    - Implement `extractCAM()` method
    - Use regex to find "CAM Recovery - Billed" rows
    - Clean and return numeric value
    - Return 0 if not found
    - Log extraction details
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 5.3 Implement insurance extraction
    - Implement `extractInsurance()` method
    - Use regex to find "INS Recovery - Billed" rows
    - Clean and return numeric value
    - Return 0 if not found
    - Log extraction details
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 5.4 Implement tax extraction
    - Implement `extractTax()` method
    - Use regex to find "RET Recovery - Billed" rows
    - Clean and return numeric value
    - Return 0 if not found
    - Log extraction details
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 5.5 Write property test for numeric validation
    - **Property 19: Numeric Validation**
    - Generate numeric extractions
    - Verify results are valid numbers (not NaN or Infinity)
    - **Validates: Requirements 13.1**

- [ ] 6. Implement monthly payments extraction
  - [x] 6.1 Implement monthly payments extraction method
    - Implement `extractMonthlyPayments()` method
    - Loop through all 12 months (Jan-Dec)
    - Use regex to find monthly payment values for each month
    - Clean and convert to numbers
    - Return 0 for missing months
    - Log extraction for each month
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 7. Implement calculations and suite data assembly
  - [x] 7.1 Implement total due calculation
    - Calculate totalDueMonth as baseRent + cam + ins + tax
    - Log calculation formula
    - Handle missing values as 0
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ]* 7.2 Write property test for total due calculation
    - **Property 7: Total Due Calculation**
    - Generate random charge values
    - Verify totalDueMonth equals sum of components
    - **Validates: Requirements 9.1**
  
  - [x] 7.3 Implement suite data assembly
    - Implement `extractSuiteData()` method
    - Call all extraction methods for a suite
    - Assemble SuiteDataDto object
    - Set default values for missing lease terms (null for dates, 0 for fees)
    - Return complete suite data
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.2_

- [ ] 8. Implement main extraction orchestration
  - [x] 8.1 Complete extractFinancialData method
    - Initialize extraction logs array
    - Call PdfParserUtil.parsePdf() to get text
    - Extract property-level information
    - Extract all suite identifiers
    - Loop through identifiers and extract suite data
    - Build ExtractionResultDto with timestamps
    - Include extraction logs in result
    - Handle errors and add to logs
    - _Requirements: 1.1, 11.1, 11.3, 12.1, 12.2, 12.3, 12.4_
  
  - [ ]* 8.2 Write property test for extraction logs presence
    - **Property 12: Extraction Logs Presence**
    - Generate extraction results
    - Verify extractionLogs array exists and has entries
    - **Validates: Requirements 12.4**
  
  - [ ]* 8.3 Write property test for extraction logs for values
    - **Property 13: Extraction Logs for Values**
    - Generate extraction results
    - Verify logs exist for each extracted value
    - **Validates: Requirements 12.1**
  
  - [ ]* 8.4 Write property test for calculation logs
    - **Property 14: Calculation Logs**
    - Generate extraction results with calculations
    - Verify logs show calculation formulas
    - **Validates: Requirements 12.2**
  
  - [ ]* 8.5 Write property test for error logging
    - **Property 15: Error Logging**
    - Generate extraction failures
    - Verify errors appear in extractionLogs
    - **Validates: Requirements 12.3, 13.4**
  
  - [ ]* 8.6 Write property test for missing field warnings
    - **Property 20: Missing Field Warnings**
    - Generate PDFs with missing fields
    - Verify validation warnings in logs
    - **Validates: Requirements 13.3**
  
  - [ ]* 8.7 Write property test for ISO 8601 timestamp format
    - **Property 11: ISO 8601 Timestamp Format**
    - Generate extraction results
    - Verify createdAt and updatedAt are valid ISO 8601 strings
    - **Validates: Requirements 11.3**

- [~] 9. Checkpoint - Ensure service tests pass
  - Run all service unit tests
  - Run all property-based tests for service methods
  - Verify extraction logic works with sample PDF text
  - Ask the user if questions arise

- [x] 10. Implement ForeSightPdfExtractorController
  - [x] 10.1 Create controller class
    - Create controller file: `src/modules/foresight-pdf-extractor/foresight-pdf-extractor.controller.ts`
    - Add @Controller('foresight-pdf-extractor') decorator
    - Inject ForeSightPdfExtractorService
    - Add Swagger decorators: @ApiTags('foresight-pdf-extractor')
    - _Requirements: 14.1_
  
  - [x] 10.2 Implement POST /extract endpoint
    - Create `extractPdf()` method with @Post('extract') decorator
    - Use @UseInterceptors(FileInterceptor('file')) for file upload
    - Add @UploadedFile() decorator for file parameter
    - Validate file exists and mimetype is 'application/pdf'
    - Call service.extractFinancialData(file.buffer)
    - Return ExtractionResultDto
    - Add Swagger decorators: @ApiOperation(), @ApiConsumes('multipart/form-data'), @ApiBody(), @ApiResponse()
    - _Requirements: 14.1, 14.2, 14.4_
  
  - [x] 10.3 Implement error handling
    - Add try-catch block around service call
    - Throw BadRequestException for invalid file format
    - Throw InternalServerErrorException for parsing errors
    - Return appropriate HTTP status codes
    - _Requirements: 14.3_
  
  - [ ]* 10.4 Write property test for HTTP success response
    - **Property 17: HTTP Success Response**
    - Generate valid PDF uploads
    - Verify HTTP 200 status and JSON payload
    - **Validates: Requirements 14.2, 14.4**
  
  - [ ]* 10.5 Write property test for HTTP error response
    - **Property 18: HTTP Error Response**
    - Generate invalid inputs
    - Verify appropriate HTTP error status codes
    - **Validates: Requirements 14.3**

- [x] 11. Complete module registration
  - [x] 11.1 Configure ForeSightPdfExtractorModule
    - Import required NestJS modules (MulterModule if needed)
    - Register controller and service
    - Export service for potential use by other modules
    - _Requirements: 14.1_
  
  - [x] 11.2 Register module in AppModule
    - Import ForeSightPdfExtractorModule in src/app.module.ts
    - Add to imports array
    - _Requirements: 14.1_

- [ ] 12. Write integration tests
  - [ ]* 12.1 Create end-to-end test file
    - Create test file: `test/foresight-pdf-extractor.e2e-spec.ts`
    - Set up test module with ForeSightPdfExtractorModule
    - Create sample ForeSight PDF for testing
    - _Requirements: 14.1, 14.2_
  
  - [ ]* 12.2 Write integration test for complete extraction
    - Upload sample PDF via HTTP POST
    - Verify response structure matches ExtractionResultDto
    - Verify extracted values match expected values from sample PDF
    - Verify extraction logs are present
    - _Requirements: 11.1, 11.2, 11.3, 12.4_
  
  - [ ]* 12.3 Write integration test for multiple suites
    - Upload PDF with multiple suites
    - Verify all suites are extracted
    - Verify property ID consistency across suites
    - _Requirements: 2.4, 3.1, 3.2_
  
  - [ ]* 12.4 Write integration test for missing data
    - Upload PDF with missing optional fields
    - Verify default values are used (0 for numbers, null for dates)
    - Verify warnings in extraction logs
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 13.3_
  
  - [ ]* 12.5 Write integration test for invalid file
    - Upload non-PDF file
    - Verify HTTP 400 error response
    - Verify error message
    - _Requirements: 14.3_

- [~] 13. Final checkpoint - Ensure all tests pass
  - Run all unit tests: `npm test`
  - Run all property-based tests
  - Run all integration tests: `npm run test:e2e`
  - Verify test coverage meets requirements
  - Ensure all tests pass, ask the user if questions arise

- [ ] 14. Add documentation and examples
  - [ ] 14.1 Update README or create module documentation
    - Document API endpoint usage
    - Provide curl example for PDF upload
    - Document expected JSON response format
    - Document error responses
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  
  - [ ] 14.2 Add JSDoc comments to public methods
    - Add JSDoc to service methods
    - Add JSDoc to controller methods
    - Add JSDoc to utility methods
    - Document parameters and return types
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property-based tests use the fast-check library already available in package.json
- Each property test should run minimum 100 iterations
- The actual regex patterns will need refinement based on real ForeSight PDF samples
- Consider adding file size limits (10MB) and timeout limits during implementation
- Swagger documentation will be automatically generated from decorators
- All extraction logs should use consistent format for easier parsing
