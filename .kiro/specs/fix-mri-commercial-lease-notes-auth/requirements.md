# Requirements Document

## Introduction

The MRI API call `MRI_S-PMCM_CommercialLeasesNoteByBuildingID` is failing with 401 Unauthorized errors when attempting to create commercial lease notes. This prevents the leasing service from adding renewal notes to commercial leases, which is critical for tracking upcoming lease renewals. Other MRI APIs using the same authentication pattern work correctly, indicating a specific issue with this API endpoint's authentication or parameter formatting.

## Glossary

- **MRI_API**: The MRI Software API system for property management data
- **Commercial_Lease_Notes_API**: The specific MRI stored procedure `MRI_S-PMCM_CommercialLeasesNoteByBuildingID`
- **Authentication_Handler**: The MriCoreService component that manages API authentication
- **Leasing_Service**: The service that calls the commercial lease notes API for renewal management
- **Basic_Auth**: HTTP Basic Authentication using clientId/databaseName/userId/developerKey:password format

## Requirements

### Requirement 1: API Authentication Resolution

**User Story:** As a system administrator, I want the commercial lease notes API to authenticate successfully, so that renewal notes can be created without 401 errors.

#### Acceptance Criteria

1. WHEN the Commercial_Lease_Notes_API is called with valid credentials, THE MRI_API SHALL accept the authentication and process the request
2. WHEN the same credentials are used for other working MRI APIs, THE Commercial_Lease_Notes_API SHALL use identical authentication format
3. WHEN authentication fails, THE System SHALL log specific error details including API name, credentials format, and response headers
4. THE Authentication_Handler SHALL generate Basic_Auth headers in the exact format: `clientId/databaseName/userId/developerKey:password`

### Requirement 2: API Endpoint Verification

**User Story:** As a developer, I want to verify the API endpoint name and parameters are correct, so that the API call reaches the intended MRI stored procedure.

#### Acceptance Criteria

1. WHEN calling the Commercial_Lease_Notes_API, THE System SHALL use the exact API name `MRI_S-PMCM_CommercialLeasesNoteByBuildingID`
2. WHEN comparing with working APIs, THE Commercial_Lease_Notes_API SHALL follow identical URL construction patterns
3. WHEN API name case sensitivity matters, THE System SHALL preserve exact capitalization and special characters
4. THE System SHALL validate that query parameters match MRI documentation requirements

### Requirement 3: Request Format Validation

**User Story:** As a developer, I want to ensure request body and parameter formatting matches MRI expectations, so that the API accepts the request structure.

#### Acceptance Criteria

1. WHEN creating commercial lease notes, THE System SHALL format the request body with the correct JSON structure
2. WHEN using PUT method for creation, THE System SHALL include required query parameters `$api` and `$format`
3. WHEN comparing with working MRI APIs, THE Commercial_Lease_Notes_API SHALL use consistent parameter naming conventions
4. THE System SHALL wrap the entry data in the correct nested structure: `mri_s-pmcm_commercialleasesnotebybuildingid.entry`

### Requirement 4: Error Diagnosis and Logging

**User Story:** As a system administrator, I want detailed error logging for authentication failures, so that I can diagnose and resolve API issues quickly.

#### Acceptance Criteria

1. WHEN 401 errors occur, THE System SHALL log the complete request headers including Authorization header format
2. WHEN API calls fail, THE System SHALL log request URL, parameters, and response details
3. WHEN comparing successful vs failed calls, THE System SHALL highlight differences in authentication or request format
4. THE System SHALL provide actionable error messages indicating specific authentication or formatting issues

### Requirement 5: Authentication Consistency

**User Story:** As a developer, I want all MRI APIs to use identical authentication mechanisms, so that working APIs serve as reference implementations.

#### Acceptance Criteria

1. WHEN examining working MRI APIs like `MRI_S-PMCM_LeaseNotes`, THE Commercial_Lease_Notes_API SHALL use identical authentication patterns
2. WHEN credentials are loaded from configuration, THE System SHALL use the same environment variables and format
3. WHEN Basic Auth headers are generated, THE System SHALL use identical encoding and structure across all MRI APIs
4. THE Authentication_Handler SHALL apply consistent retry logic and error handling for all MRI API calls