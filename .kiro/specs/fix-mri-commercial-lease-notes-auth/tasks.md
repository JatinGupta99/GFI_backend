# Implementation Plan: Fix MRI Commercial Lease Notes Authentication

## Overview

This implementation plan systematically diagnoses and fixes the 401 Unauthorized error with the `MRI_S-PMCM_CommercialLeasesNoteByBuildingID` API. The approach involves comparing authentication patterns between working and failing APIs, implementing enhanced logging for diagnosis, and applying targeted fixes to ensure consistent authentication handling.

## Tasks

- [ ] 1. Implement authentication debugging and comparison utilities
  - [x] 1.1 Add authentication comparison logging to MriCoreService
    - Enhance the `authHeader` getter to log authentication string components
    - Add method to compare authentication headers between different API calls
    - Log credential format and encoding details for debugging
    - _Requirements: 1.3, 4.1, 4.2_

  - [ ]* 1.2 Write property test for authentication header consistency
    - **Property 1: Authentication Consistency Across APIs**
    - **Validates: Requirements 1.2, 2.2, 3.3, 5.1, 5.3**

  - [x] 1.3 Add request/response logging enhancement for commercial lease notes API
    - Log complete request URL, headers, parameters, and body for failing API
    - Log response headers and status codes for 401 errors
    - Compare request format with working MRI APIs (MRI_S-PMCM_LeaseNotes)
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2. Investigate and fix API endpoint and parameter issues
  - [x] 2.1 Verify API endpoint name and case sensitivity
    - Compare API name `MRI_S-PMCM_CommercialLeasesNoteByBuildingID` with MRI documentation
    - Test case sensitivity and special character handling
    - Verify URL construction matches working APIs
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ]* 2.2 Write property test for request format compliance
    - **Property 3: Request Format Compliance**
    - **Validates: Requirements 1.4, 2.1, 2.3, 3.1, 3.2, 3.4**

  - [x] 2.3 Fix request body structure and parameter formatting
    - Compare request body structure with working MRI APIs
    - Verify the nested JSON structure: `mri_s-pmcm_commercialleasesnotebybuildingid.entry`
    - Ensure query parameters `$api` and `$format` are correctly included
    - Test parameter naming conventions against MRI documentation
    - _Requirements: 3.1, 3.2, 3.4_

- [ ] 3. Checkpoint - Test authentication and request format fixes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement comprehensive error handling and validation
  - [x] 4.1 Add credential validation and error reporting
    - Validate all required environment variables are present and non-empty
    - Add specific error messages for missing or invalid credentials
    - Implement credential format validation
    - _Requirements: 1.1, 1.4, 5.2_

  - [ ]* 4.2 Write property test for authentication success with valid credentials
    - **Property 2: Authentication Success with Valid Credentials**
    - **Validates: Requirements 1.1**

  - [ ] 4.3 Enhance error logging with actionable diagnostics
    - Implement comparison logging between successful and failed API calls
    - Add specific error messages indicating authentication vs formatting issues
    - Include suggestions for resolving common authentication problems
    - _Requirements: 4.3, 4.4_

  - [ ]* 4.4 Write property test for comprehensive error logging
    - **Property 4: Comprehensive Error Logging**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] 5. Ensure consistency across all MRI APIs
  - [ ] 5.1 Standardize authentication handling across MRI services
    - Verify MriCoreService applies identical authentication to all MRI APIs
    - Ensure consistent retry logic and error handling patterns
    - Validate environment variable usage consistency
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ]* 5.2 Write property test for parameter validation compliance
    - **Property 5: Parameter Validation Compliance**
    - **Validates: Requirements 2.4**

  - [ ]* 5.3 Write property test for configuration and behavior consistency
    - **Property 6: Configuration and Behavior Consistency**
    - **Validates: Requirements 5.2, 5.4**

- [ ] 6. Integration testing and validation
  - [x] 6.1 Test commercial lease notes API end-to-end
    - Test the complete flow from LeasingService.addRenewalNote() to MRI API
    - Verify successful note creation with valid test data
    - Test error handling with invalid credentials and malformed requests
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ]* 6.2 Write integration tests for leasing service note operations
    - Test addRenewalNote() and getRenewalNotes() methods
    - Test error scenarios and recovery
    - _Requirements: 1.1, 4.4_

- [ ] 7. Final checkpoint - Ensure all tests pass and API works correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Focus on systematic diagnosis before implementing fixes
- Property tests validate universal correctness properties with minimum 100 iterations
- suite tests validate specific examples and error conditions
- Enhanced logging is critical for diagnosing the root cause of 401 errors