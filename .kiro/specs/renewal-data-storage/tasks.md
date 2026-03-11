# Implementation Plan: Renewal Data Storage

## Overview

This implementation plan converts the renewal-data-storage feature design into discrete coding tasks that build incrementally. The feature extends the existing renewals module to fetch, combine, and store data from three MRI APIs, following established NestJS patterns and integrating with the existing architecture.

## Tasks

- [ ] 1. Set up core interfaces and data types
  - Create TypeScript interfaces for MRI API responses (OpenCharges, TenantLedger, CurrentDelinquencies)
  - Define combined data types and mapping interfaces
  - Create DTOs for renewal data queries and responses
  - Set up validation schemas for API responses
  - _Requirements: 1.1, 1.2, 1.3, 5.3, 5.4_

- [ ] 2. Extend renewal entity with MRI data fields
  - [ ] 2.1 Add new fields to existing Renewal entity
    - Add financial data fields (monthlyRent, cam, insurance, tax, etc.)
    - Add aging bucket fields (days0To30, days31To60, days61Plus)
    - Add metadata fields (mriDataSources, lastMriSync, mriDataQuality)
    - Update database indexes for new fields
    - _Requirements: 3.1, 3.2_

  - [ ]* 2.2 Write property test for renewal entity extension
    - **Property 6: Data Storage Completeness**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 3. Implement MRI API data providers
  - [ ] 3.1 Create MriOpenChargesProvider
    - Implement API client for OpenCharges endpoint
    - Add request/response validation
    - Handle authentication using existing MRI configuration
    - _Requirements: 1.1, 1.4, 1.5_

  - [ ] 3.2 Create MriTenantLedgerProvider
    - Implement API client for TenantLedger endpoint
    - Add request/response validation
    - Handle authentication using existing MRI configuration
    - _Requirements: 1.2, 1.4, 1.5_

  - [ ] 3.3 Create MriCurrentDelinquenciesProvider
    - Implement API client for CurrentDelinquencies endpoint
    - Add request/response validation
    - Handle authentication using existing MRI configuration
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 3.4 Write property tests for API providers
    - **Property 1: API Response Structure Completeness**
    - **Property 2: API Error Handling Resilience**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [ ] 4. Implement data fetching service
  - [ ] 4.1 Create MriDataFetcherService
    - Orchestrate calls to all three MRI API providers
    - Implement parallel API calls with error handling
    - Add retry logic with exponential backoff
    - Handle rate limiting and throttling
    - _Requirements: 1.4, 7.1, 7.3_

  - [ ]* 4.2 Write property tests for data fetcher
    - **Property 15: Retry and Error Recovery**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 5. Implement field mapping service
  - [ ] 5.1 Create FieldMappingService
    - Implement mapping logic for all income categories
    - Handle temporal data processing (Balance Forward, Cash Received)
    - Add data validation and normalization
    - Implement cross-API consistency validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.2 Write property tests for field mapping
    - **Property 3: Field Mapping Correctness**
    - **Property 4: OpenCharges Data Mapping**
    - **Property 5: Temporal Data Processing**
    - **Validates: Requirements 2.1-2.11**

  - [ ]* 5.3 Write property tests for data validation
    - **Property 11: Cross-API Data Consistency**
    - **Property 12: Data Validation and Normalization**
    - **Property 13: Incomplete Data Handling**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 6. Checkpoint - Core data processing complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Extend renewal repository for MRI data
  - [ ] 7.1 Extend RenewalRepository
    - Add methods for saving renewal data with MRI fields
    - Implement upsert logic for duplicate handling
    - Add query methods for renewal data retrieval
    - Maintain referential integrity with existing renewals
    - _Requirements: 3.3, 3.4, 4.1, 4.2, 4.3_

  - [ ]* 7.2 Write property tests for repository operations
    - **Property 7: Duplicate Data Handling**
    - **Property 8: Storage Error Handling**
    - **Property 9: Query Functionality**
    - **Validates: Requirements 3.3, 3.4, 3.5, 4.1, 4.2, 4.3**

- [ ] 8. Implement main renewal data service
  - [ ] 8.1 Create RenewalDataService
    - Orchestrate data fetching, mapping, and storage
    - Implement sync operations for properties
    - Add caching for improved performance
    - Handle background processing with BullMQ
    - _Requirements: 3.1, 6.4_

  - [ ]* 8.2 Write integration tests for renewal data service
    - Test end-to-end data flow from APIs to storage
    - Test error handling across all components
    - _Requirements: 3.1, 3.5, 7.2_

- [ ] 9. Add API endpoints to renewals controller
  - [ ] 9.1 Extend RenewalsController
    - Add endpoint for triggering MRI data sync
    - Add endpoints for querying renewal data with MRI fields
    - Implement proper error handling and response formatting
    - Add authentication and authorization
    - _Requirements: 4.4, 6.3, 6.5_

  - [ ]* 9.2 Write property tests for API endpoints
    - **Property 10: Empty Result Handling**
    - **Property 14: API Response Format Consistency**
    - **Property 16: Validation Error Messaging**
    - **Validates: Requirements 4.4, 4.5, 6.3, 7.4**

- [ ] 10. Implement health check and monitoring
  - [ ] 10.1 Add health check endpoints
    - Implement MRI API connectivity checks
    - Add data freshness monitoring
    - Create system status reporting
    - _Requirements: 7.5_

  - [ ]* 10.2 Write property tests for health checks
    - **Property 17: Health Check Reporting**
    - **Validates: Requirements 7.5**

- [ ] 11. Add background job processing
  - [ ] 11.1 Create renewal data sync processor
    - Implement BullMQ job processor for background sync
    - Add job scheduling for periodic data updates
    - Handle job failures and retries
    - _Requirements: 6.4, 7.1_

  - [ ]* 11.2 Write unit tests for job processing
    - Test job scheduling and execution
    - Test failure handling and retry logic
    - _Requirements: 6.4, 7.1_

- [ ] 12. Integration and module wiring
  - [ ] 12.1 Update RenewalsModule
    - Register all new services and providers
    - Configure BullMQ queues for renewal data sync
    - Set up proper dependency injection
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ] 12.2 Update database migrations
    - Create migration scripts for new renewal fields
    - Update existing indexes for performance
    - _Requirements: 6.2_

- [ ] 13. Final checkpoint and validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and integration points
- The implementation follows existing NestJS patterns and integrates with current architecture
- Background processing uses existing BullMQ infrastructure
- All API endpoints follow existing authentication and response format patterns