# Requirements Document

## Introduction

This document specifies the requirements for an Excel Upload API that accepts property budget/proforma data in Excel format, parses financial information organized by category and month, and updates suite-level data within a property's database record. The API is designed to integrate ForeSight Detail Proforma data into a NestJS application with MongoDB storage.

## Glossary

- **API**: The Excel Upload API endpoint
- **Excel_File**: An uploaded file in .xlsx or .xls format containing financial data
- **Property**: A real estate property entity stored in the MongoDB Property collection
- **Suite**: A rentable unit within a property, stored in the property's suites array
- **Financial_Data**: Monthly budget/proforma data including rental income and recovery categories
- **Category**: A type of financial data (rental income, CAM recovery, insurance recovery, etc.)
- **Monthly_Data**: Financial values organized by month (Jan-26, Feb-26, etc.)
- **Parser**: The component that extracts structured data from Excel files
- **Database**: The MongoDB database storing property and suite information
- **ForeSight**: The source system that generates the Excel proforma files

## Requirements

### Requirement 1: File Upload Acceptance

**User Story:** As an API client, I want to upload an Excel file containing property financial data, so that I can import budget/proforma information into the system.

#### Acceptance Criteria

1. WHEN a client sends a multipart/form-data request with an Excel file, THE API SHALL accept the file upload
2. THE API SHALL support Excel files with .xlsx extension
3. THE API SHALL support Excel files with .xls extension
4. WHEN a file with an unsupported extension is uploaded, THE API SHALL reject the request and return an error response
5. WHEN the uploaded file is not a valid Excel format, THE API SHALL reject the request and return an error response

### Requirement 2: Request Parameter Handling

**User Story:** As an API client, I want to specify which property and suite to update, so that the financial data is stored in the correct location.

#### Acceptance Criteria

1. THE API SHALL accept a propertyId parameter in the request
2. THE API SHALL accept a suiteId parameter in the request
3. WHEN the propertyId parameter is missing, THE API SHALL return an error response indicating the missing parameter
4. WHEN the suiteId parameter is missing, THE API SHALL return an error response indicating the missing parameter
5. THE API SHALL validate that propertyId is a non-empty string
6. THE API SHALL validate that suiteId is a non-empty string

### Requirement 3: Excel File Parsing

**User Story:** As a system, I want to parse Excel files to extract financial data, so that I can process and store the information correctly.

#### Acceptance Criteria

1. WHEN the Parser receives a valid Excel file, THE Parser SHALL extract category names from the first column
2. WHEN the Parser receives a valid Excel file, THE Parser SHALL extract month headers from the first row
3. WHEN the Parser receives a valid Excel file, THE Parser SHALL extract numerical values for each category-month combination
4. THE Parser SHALL recognize "Total Rental Income" as the rental income category
5. THE Parser SHALL recognize "CAM Recovery" as the CAM recovery category
6. THE Parser SHALL recognize "Insurance Recovery" as the insurance recovery category
7. THE Parser SHALL recognize "Real Estate Tax Recovery" as the real estate tax recovery category
8. THE Parser SHALL recognize "Other Income (Water)" or "Water" as the water income category
9. THE Parser SHALL extract the "Total" column values as annual totals for each category
10. WHEN the Parser encounters a cell with comma-separated numbers, THE Parser SHALL convert them to numeric values
11. WHEN the Parser encounters an empty or invalid cell value, THE Parser SHALL treat it as zero or null appropriately
12. WHEN the Excel file structure does not match the expected format, THE Parser SHALL return an error indicating parsing failure

### Requirement 4: Property Validation

**User Story:** As a system, I want to verify that the property exists before updating data, so that I prevent data corruption and provide clear error messages.

#### Acceptance Criteria

1. WHEN the API receives a propertyId, THE Database SHALL query for a property with that identifier
2. WHEN the property exists in the Database, THE API SHALL proceed with the update operation
3. WHEN the property does not exist in the Database, THE API SHALL return an error response indicating the property was not found
4. THE API SHALL include the propertyId in the error response when a property is not found

### Requirement 5: Suite Data Update

**User Story:** As a system, I want to update or create suite data within a property, so that financial information is stored at the correct granularity.

#### Acceptance Criteria

1. WHEN a suite with the specified suiteId exists in the property's suites array, THE API SHALL update that suite's data
2. WHEN a suite with the specified suiteId does not exist in the property's suites array, THE API SHALL create a new suite entry
3. WHEN updating a suite, THE API SHALL preserve existing suite data not included in the Excel file
4. THE API SHALL store monthly financial data in a monthlyData object within the suite
5. THE API SHALL store annual total financial data in a totalAnnual object within the suite
6. WHEN the Excel file contains a tenant name, THE API SHALL update the suite's tenantName field
7. THE API SHALL persist the updated property document to the Database

### Requirement 6: Monthly Financial Data Storage

**User Story:** As a system, I want to store financial data organized by month, so that users can analyze budget/proforma information over time.

#### Acceptance Criteria

1. FOR each month in the Excel file, THE API SHALL create a monthly data entry with the month identifier as the key
2. WHEN storing monthly data, THE API SHALL include rentalIncome value
3. WHEN storing monthly data, THE API SHALL include camRecovery value
4. WHEN storing monthly data, THE API SHALL include insuranceRecovery value
5. WHEN storing monthly data, THE API SHALL include realEstateTaxRecovery value
6. WHEN storing monthly data, THE API SHALL include waterIncome value
7. WHEN storing monthly data, THE API SHALL calculate and include totalIncome as the sum of all income categories
8. THE API SHALL store numerical values without currency symbols or formatting characters

### Requirement 7: Annual Total Data Storage

**User Story:** As a system, I want to store annual totals for each financial category, so that users can quickly access yearly summaries.

#### Acceptance Criteria

1. THE API SHALL create a totalAnnual object containing annual sums for each category
2. WHEN storing annual totals, THE API SHALL include rentalIncome total
3. WHEN storing annual totals, THE API SHALL include camRecovery total
4. WHEN storing annual totals, THE API SHALL include insuranceRecovery total
5. WHEN storing annual totals, THE API SHALL include realEstateTaxRecovery total
6. WHEN storing annual totals, THE API SHALL include waterIncome total
7. WHEN storing annual totals, THE API SHALL calculate and include totalIncome as the sum of all annual category totals

### Requirement 8: Error Handling

**User Story:** As an API client, I want to receive clear error messages when something goes wrong, so that I can understand and fix the issue.

#### Acceptance Criteria

1. WHEN an error occurs during file upload, THE API SHALL return an HTTP error status code
2. WHEN an error occurs during parsing, THE API SHALL return an error response with details about the parsing failure
3. WHEN a property is not found, THE API SHALL return a 404 status code
4. WHEN request parameters are invalid, THE API SHALL return a 400 status code
5. WHEN the Excel file format is invalid, THE API SHALL return a 400 status code with a descriptive error message
6. WHEN a database operation fails, THE API SHALL return a 500 status code
7. THE API SHALL include an error message in the response body for all error conditions
8. THE API SHALL log errors with sufficient detail for debugging purposes

### Requirement 9: Success Response

**User Story:** As an API client, I want to receive confirmation when data is successfully uploaded, so that I know the operation completed correctly.

#### Acceptance Criteria

1. WHEN the upload and update operation succeeds, THE API SHALL return a 200 status code
2. WHEN the operation succeeds, THE API SHALL include the propertyId in the response
3. WHEN the operation succeeds, THE API SHALL include the suiteId in the response
4. WHEN the operation succeeds, THE API SHALL include a count of months processed in the response
5. WHEN the operation succeeds, THE API SHALL include a success message in the response
6. THE API SHALL return the response in JSON format

### Requirement 10: Data Integrity

**User Story:** As a system administrator, I want to ensure data integrity during updates, so that existing property data is not corrupted.

#### Acceptance Criteria

1. WHEN updating a suite, THE API SHALL use atomic database operations to prevent partial updates
2. WHEN a database operation fails, THE API SHALL not modify the property document
3. WHEN updating suite data, THE API SHALL validate that all required fields are present before persisting
4. THE API SHALL ensure that numerical values are stored as numbers, not strings
5. WHEN multiple suites exist in a property, THE API SHALL only update the specified suite

### Requirement 11: ForeSight Format Compatibility

**User Story:** As a system, I want to correctly parse ForeSight Detail Proforma Excel files, so that data from the source system is accurately imported.

#### Acceptance Criteria

1. THE Parser SHALL recognize ForeSight Detail Proforma Excel file structure
2. THE Parser SHALL handle summary view data with category rows and month columns
3. THE Parser SHALL handle detailed line-item data with suite identifiers and account codes
4. WHEN the Excel contains account code 500005, THE Parser SHALL map it to rental income
5. WHEN the Excel contains account code 534005, THE Parser SHALL map it to CAM recovery
6. WHEN the Excel contains account code 544005, THE Parser SHALL map it to insurance recovery
7. WHEN the Excel contains account code 554005, THE Parser SHALL map it to real estate tax recovery
8. WHEN the Excel contains account code 564010, THE Parser SHALL map it to water income
9. THE Parser SHALL extract suite identifiers in the format "XXXXXX-XXXX" when present
10. THE Parser SHALL extract tenant names from the Excel when present in the detailed view
