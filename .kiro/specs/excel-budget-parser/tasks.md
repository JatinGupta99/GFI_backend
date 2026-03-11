# Implementation Plan: Excel Budget Parser

## Overview

This implementation plan extends the existing ForeSight PDF extractor module to handle Excel budget files. The parser integrates with the current suites API infrastructure, leveraging the existing upload endpoint and data storage patterns. Tasks focus on enhancing the existing `BudgetExcelParserUtil` class and ensuring seamless integration with the suites system.

## Tasks

- [x] 1. Enhance Excel parsing interfaces and data structures
  - Update existing interfaces in `budget-excel-parser.util.ts` to support new Excel parsing requirements
  - Add `ExcelSuiteData` interface with all required fields (propertyId, suiteId, status, etc.)
  - Add `ExcelExtractionResult` interface for comprehensive extraction results
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 2. Implement tenant identification and pattern matching
  - [x] 2.1 Create tenant row discovery methods
    - Implement `findTenantRows()` to identify all tenant rows in Excel worksheet
    - Implement `extractTenantIdentifiers()` to parse Suite ID, Property ID, and status from tenant lines
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 2.2 Write property test for tenant identifier extraction
    - **Property 3: Tenant Identifier Extraction**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  
  - [ ]* 2.3 Write property test for invalid format handling
    - **Property 4: Invalid Format Handling**
    - **Validates: Requirements 2.4**

- [ ] 3. Implement section-based data extraction methods
  - [x] 3.1 Create section processing methods
    - Implement `extractFromRentalIncomeSection()` for base rent and square footage
    - Implement `extractFromCAMSection()` for CAM recovery data
    - Implement `extractFromINSSection()` for insurance recovery data
    - Implement `extractFromRETSection()` for tax recovery data
    - _Requirements: 3.1, 3.2, 4.1, 6.1, 7.1, 8.1_
  
  - [ ]* 3.2 Write property test for financial data cleaning
    - **Property 5: Financial Data Cleaning**
    - **Validates: Requirements 4.2, 4.3, 6.2, 6.3, 7.2, 7.3, 8.2, 8.3**
  
  - [ ]* 3.3 Write property test for missing data handling
    - **Property 6: Missing Data Default Values**
    - **Validates: Requirements 4.4, 6.4, 7.4, 8.4**

- [ ] 4. Implement tenant improvements and leasing commission extraction
  - [x] 4.1 Create TI and monthly payment extraction methods
    - Implement `extractFromTISection()` for tenant improvement data
    - Implement `extractFromLeasingCommissionSection()` for monthly payments
    - _Requirements: 10.1, 10.2, 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ]* 4.2 Write property test for monthly payments structure
    - **Property 11: Monthly Payments Structure**
    - **Validates: Requirements 11.5**

- [ ] 5. Implement calculation methods for derived values
  - [x] 5.1 Create calculation methods
    - Implement `calculateBaseRentPerSf()` with proper rounding
    - Implement `calculateTotalDueMonth()` with component summation
    - Implement `calculateTiPerSf()` with division by zero handling
    - _Requirements: 5.1, 5.2, 9.1, 9.2, 10.3_
  
  - [ ]* 5.2 Write property test for base rent per SF calculation
    - **Property 8: Base Rent Per Square Foot Calculation**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  
  - [ ]* 5.3 Write property test for total due month calculation
    - **Property 9: Total Due Month Calculation**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
  
  - [ ]* 5.4 Write property test for TI per SF calculation
    - **Property 10: TI Per Square Foot Calculation**
    - **Validates: Requirements 10.3, 10.4**

- [ ] 6. Checkpoint - Ensure core extraction logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement tenant status determination and validation
  - [x] 7.1 Create status determination logic
    - Implement tenant status logic (Vacant/Occupied/Unknown)
    - Add comprehensive data validation for extracted values
    - Add range validation with warning logs for unusual values
    - _Requirements: 12.1, 12.2, 12.3, 15.1, 15.2, 15.3_
  
  - [ ]* 7.2 Write property test for tenant status determination
    - **Property 12: Tenant Status Determination**
    - **Validates: Requirements 12.1, 12.2, 12.3**
  
  - [ ]* 7.3 Write property test for data validation
    - **Property 15: Data Validation and Error Reporting**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4**

- [ ] 8. Enhance main extraction method for multiple tenants
  - [x] 8.1 Update `extractBudgetData()` method
    - Enhance existing method to handle multiple tenants per property
    - Implement multi-pass extraction strategy (discovery → extraction → calculation → validation)
    - Add comprehensive error handling and logging
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ]* 8.2 Write property test for multiple tenant processing
    - **Property 13: Multiple Tenant Processing**
    - **Validates: Requirements 13.1, 13.2, 13.3**

- [ ] 9. Implement comprehensive error handling
  - [x] 9.1 Add robust error handling throughout parser
    - Implement file-level error handling for corrupted Excel files
    - Add section-level error handling for missing required sections
    - Implement tenant-level error handling with partial processing capability
    - _Requirements: 1.2, 1.4, 17.1, 17.2, 17.3, 17.4_
  
  - [ ]* 9.2 Write property test for Excel parsing resilience
    - **Property 1: Excel File Parsing Resilience**
    - **Validates: Requirements 1.1, 1.2, 1.4**
  
  - [ ]* 9.3 Write property test for resilient error handling
    - **Property 17: Resilient Error Handling**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

- [ ] 10. Ensure integration with existing suites system
  - [x] 10.1 Verify integration points
    - Ensure compatibility with existing `SuitesService.processBudgetFile()` method
    - Verify data format matches existing `BudgetSuiteUpdateDto` structure
    - Test integration with existing upload endpoint `/suites/upload-budget`
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [ ]* 10.2 Write integration test for end-to-end processing
    - **Property 16: End-to-End Processing**
    - **Validates: Requirements 16.2, 16.3, 16.4**

- [ ] 11. Add comprehensive unit tests for edge cases
  - [x] 11.1 Create unit tests for specific scenarios
    - Test with actual Excel file structures matching ForeSight format
    - Test edge cases: empty files, single tenant, maximum tenants
    - Test error scenarios: corrupted files, missing sections, invalid data
    - Test API integration with various file types and error responses
    - _Requirements: 1.1, 1.3, 2.4, 3.3, 15.4_
  
  - [ ]* 11.2 Write property test for data preservation
    - **Property 2: Data Preservation During Parsing**
    - **Validates: Requirements 1.3**
  
  - [ ]* 11.3 Write property test for JSON output structure
    - **Property 14: JSON Output Structure**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**

- [x] 12. Final checkpoint - Ensure all tests pass and integration works
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples, edge cases, and integration points
- The implementation leverages existing infrastructure in the foresight-pdf-extractor module
- Integration with suites system uses existing patterns and data structures