# Requirements Document

## Introduction

The renewal-data-storage feature provides a system to fetch, combine, and store renewal data from three MRI APIs (OpenCharges, TenantLedger, and CurrentDelinquencies) to build comprehensive renewal reports. This system will integrate with the existing NestJS application architecture and provide APIs for querying and retrieving stored renewal data.

## Glossary

- **MRI_API**: MRI Software's Property Management API system
- **OpenCharges_API**: MRI API endpoint that returns charges and balance data
- **TenantLedger_API**: MRI API endpoint that returns payments and transaction history
- **CurrentDelinquencies_API**: MRI API endpoint that returns aging bucket information
- **Renewal_Data_Storage**: The system component responsible for storing combined renewal data
- **Field_Mapper**: Component that maps fields from multiple API responses to unified renewal data structure
- **Data_Fetcher**: Component that retrieves data from MRI APIs
- **Storage_Service**: Component that persists renewal data to the database

## Requirements

### Requirement 1: MRI API Data Fetching

**User Story:** As a system administrator, I want to fetch data from three MRI APIs, so that I can access all necessary renewal information from different data sources.

#### Acceptance Criteria

1. WHEN the system requests data from OpenCharges API, THE Data_Fetcher SHALL retrieve charges and balance data including BuildingID, LeaseID, TransactionAmount, OpenAmount, IncomeCategory, and RentTaxAmount
2. WHEN the system requests data from TenantLedger API, THE Data_Fetcher SHALL retrieve payment and transaction history including TransactionID, BuildingID, LeaseID, IncomeCategory, TransactionAmount, and OpenAmount
3. WHEN the system requests data from CurrentDelinquencies API, THE Data_Fetcher SHALL retrieve aging bucket data including BuildingID, LeaseID, ThirtyDayDelinquency, SixtyDayDelinquency, NinetyDayDelinquency, and NinetyPlusDayDelinquency
4. WHEN any MRI API request fails, THE Data_Fetcher SHALL return a descriptive error message and continue processing other APIs
5. WHEN API responses are received, THE Data_Fetcher SHALL validate the response structure against expected schemas

### Requirement 2: Field Mapping and Data Combination

**User Story:** As a data analyst, I want renewal data fields to be properly mapped and combined from multiple APIs, so that I can access unified renewal information.

#### Acceptance Criteria

1. WHEN processing TenantLedger data with IncomeCategory = "RNT Base Rent", THE Field_Mapper SHALL map this to the Monthly Rent field
2. WHEN processing OpenCharges data with IncomeCategory = "CAM", THE Field_Mapper SHALL map TransactionAmount to the CAM field
3. WHEN processing OpenCharges data with IncomeCategory = "INS", THE Field_Mapper SHALL map TransactionAmount to the Insurance field
4. WHEN processing OpenCharges data, THE Field_Mapper SHALL map RentTaxAmount to the Tax field
5. WHEN processing OpenCharges data, THE Field_Mapper SHALL map TransactionAmount to the Total Due Monthly field
6. WHEN processing TenantLedger data for periods before the current month, THE Field_Mapper SHALL map OpenAmount to the Balance Forward field
7. WHEN processing TenantLedger payment transactions, THE Field_Mapper SHALL sum payment amounts to create the Cash Received field
8. WHEN processing OpenCharges data, THE Field_Mapper SHALL map OpenAmount to the Balance Due field
9. WHEN processing CurrentDelinquencies data, THE Field_Mapper SHALL map ThirtyDayDelinquency to the 0-30 Days field
10. WHEN processing CurrentDelinquencies data, THE Field_Mapper SHALL map SixtyDayDelinquency to the 31-60 Days field
11. WHEN processing CurrentDelinquencies data, THE Field_Mapper SHALL map NinetyDayDelinquency or NinetyPlusDayDelinquency to the 61+ Days field

### Requirement 3: Data Storage and Persistence

**User Story:** As a system user, I want renewal data to be stored persistently, so that I can access historical renewal information and perform queries.

#### Acceptance Criteria

1. WHEN combined renewal data is processed, THE Storage_Service SHALL persist the data to the database with all mapped fields
2. WHEN storing renewal data, THE Storage_Service SHALL include metadata such as data source timestamps and sync information
3. WHEN duplicate renewal data is detected (same BuildingID and LeaseID), THE Storage_Service SHALL update existing records rather than create duplicates
4. WHEN storing data, THE Storage_Service SHALL maintain referential integrity with existing renewal records
5. WHEN data storage fails, THE Storage_Service SHALL log detailed error information and return failure status

### Requirement 4: Data Querying and Retrieval

**User Story:** As an application user, I want to query and retrieve stored renewal data, so that I can access renewal information for reporting and analysis.

#### Acceptance Criteria

1. WHEN a user requests renewal data by BuildingID, THE System SHALL return all renewal records for that building
2. WHEN a user requests renewal data by LeaseID, THE System SHALL return the specific renewal record with all combined fields
3. WHEN a user requests renewal data with date filters, THE System SHALL return records within the specified date range
4. WHEN a user requests renewal data, THE System SHALL return data in a consistent JSON format with all mapped fields
5. WHEN no renewal data matches the query criteria, THE System SHALL return an empty result set with appropriate metadata

### Requirement 5: Data Consistency and Validation

**User Story:** As a data integrity manager, I want to ensure data consistency across the three API sources, so that renewal reports are accurate and reliable.

#### Acceptance Criteria

1. WHEN data is fetched from multiple APIs for the same lease, THE System SHALL validate that BuildingID and LeaseID match across all sources
2. WHEN field mapping produces null or invalid values, THE System SHALL log validation warnings and use default values where appropriate
3. WHEN API data contains inconsistent date formats, THE System SHALL normalize all dates to ISO 8601 format
4. WHEN numeric fields contain non-numeric data, THE System SHALL convert to appropriate numeric types or mark as invalid
5. WHEN required fields are missing from API responses, THE System SHALL mark the record as incomplete and log the missing fields

### Requirement 6: Integration with Existing Architecture

**User Story:** As a system architect, I want the renewal data storage feature to integrate seamlessly with the existing NestJS application, so that it follows established patterns and maintains system consistency.

#### Acceptance Criteria

1. WHEN the feature is implemented, THE System SHALL follow the existing NestJS module structure with controllers, services, and repositories
2. WHEN the feature stores data, THE System SHALL use the existing MongoDB database configuration and connection
3. WHEN the feature provides APIs, THE System SHALL follow the existing API response format and error handling patterns
4. WHEN the feature processes background tasks, THE System SHALL use the existing BullMQ queue system for job processing
5. WHEN the feature handles authentication, THE System SHALL integrate with the existing JWT authentication system

### Requirement 7: Error Handling and Monitoring

**User Story:** As a system administrator, I want comprehensive error handling and monitoring, so that I can troubleshoot issues and ensure system reliability.

#### Acceptance Criteria

1. WHEN MRI API calls fail, THE System SHALL retry failed requests up to 3 times with exponential backoff
2. WHEN data processing errors occur, THE System SHALL log detailed error information including API responses and processing context
3. WHEN the system encounters rate limits from MRI APIs, THE System SHALL implement appropriate throttling and retry mechanisms
4. WHEN data validation fails, THE System SHALL provide specific error messages indicating which fields and validation rules failed
5. WHEN system health checks are performed, THE System SHALL report the status of MRI API connectivity and data freshness