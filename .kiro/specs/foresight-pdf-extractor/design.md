# Design Document: ForeSight PDF Extractor

## Overview

The ForeSight PDF Extractor is a NestJS module that extracts structured financial data from ForeSight Detail Proforma PDF documents. The system processes PDFs containing property, suite, and tenant financial information, transforming unstructured PDF content into a standardized JSON format.

The design follows NestJS architectural patterns with a dedicated module containing a controller for HTTP endpoints, a service for business logic, and DTOs for data validation. The extraction process involves PDF parsing, pattern-based text extraction, data validation, calculation of derived values, and structured JSON output generation with detailed extraction logs.

## Architecture

### Module Structure

```
src/modules/foresight-pdf-extractor/
├── foresight-pdf-extractor.module.ts
├── foresight-pdf-extractor.controller.ts
├── foresight-pdf-extractor.service.ts
├── dto/
│   ├── extract-pdf.dto.ts
│   └── extraction-result.dto.ts
├── interfaces/
│   ├── suite-data.interface.ts
│   ├── extraction-log.interface.ts
│   └── financial-charges.interface.ts
└── utils/
    ├── pdf-parser.util.ts
    ├── pattern-matcher.util.ts
    └── numeric-cleaner.util.ts
```

### Processing Pipeline

```
PDF Upload → PDF Parsing → Text Extraction → Pattern Matching → Data Extraction → 
Validation → Calculation → JSON Generation → Response with Logs
```

### Dependencies

- **pdf-parse**: Library for parsing PDF documents into text (needs to be added to package.json)
- **class-validator**: Already available for DTO validation
- **class-transformer**: Already available for DTO transformation
- **@nestjs/common**: Core NestJS decorators and utilities
- **@nestjs/swagger**: API documentation

## Components and Interfaces

### 1. ForeSightPdfExtractorModule

**Responsibility**: Module registration and dependency injection

**Pseudocode**:
```
MODULE ForeSightPdfExtractorModule
  IMPORTS: []
  CONTROLLERS: [ForeSightPdfExtractorController]
  PROVIDERS: [ForeSightPdfExtractorService]
  EXPORTS: [ForeSightPdfExtractorService]
END MODULE
```

### 2. ForeSightPdfExtractorController

**Responsibility**: HTTP endpoint handling and request/response management

**Endpoints**:
- `POST /foresight-pdf-extractor/extract` - Upload and extract PDF data

**Pseudocode**:
```
CLASS ForeSightPdfExtractorController
  CONSTRUCTOR(service: ForeSightPdfExtractorService)
  
  METHOD extractPdf(file: UploadedFile) -> ExtractionResultDto
    IF file is null OR file.mimetype != 'application/pdf' THEN
      THROW BadRequestException("Invalid file format")
    END IF
    
    result = service.extractFinancialData(file.buffer)
    RETURN result
  END METHOD
END CLASS
```

### 3. ForeSightPdfExtractorService

**Responsibility**: Core extraction logic, orchestration of parsing and data extraction

**Pseudocode**:
```
CLASS ForeSightPdfExtractorService
  CONSTRUCTOR(logger: Logger)
  
  METHOD extractFinancialData(pdfBuffer: Buffer) -> ExtractionResultDto
    logs = []
    
    // Parse PDF
    pdfText = PdfParserUtil.parsePdf(pdfBuffer)
    logs.ADD("PDF parsed successfully")
    
    // Extract property info
    propertyId = extractPropertyId(pdfText, logs)
    propertyName = extractPropertyName(pdfText, logs)
    region = extractRegion(pdfText, logs)
    
    // Extract suite data
    suiteIdentifiers = extractSuiteIdentifiers(pdfText, logs)
    suites = []
    
    FOR EACH identifier IN suiteIdentifiers DO
      suiteData = extractSuiteData(pdfText, identifier, logs)
      suites.ADD(suiteData)
    END FOR
    
    // Build result
    result = {
      propertyId: propertyId,
      propertyName: propertyName,
      region: region,
      suites: suites,
      createdAt: NOW(),
      updatedAt: NOW(),
      extractionLogs: logs
    }
    
    RETURN result
  END METHOD
  
  METHOD extractPropertyId(text: String, logs: Array) -> String
    pattern = REGEX("(\d{6})-\d{3}")
    match = pattern.FIND_FIRST(text)
    
    IF match THEN
      logs.ADD("Property ID extracted from suite identifier: " + match[1])
      RETURN match[1]
    ELSE
      logs.ADD("Property ID not found, using default")
      RETURN "UNKNOWN"
    END IF
  END METHOD
  
  METHOD extractPropertyName(text: String, logs: Array) -> String
    // Pattern to find property name (implementation specific to PDF format)
    pattern = REGEX("Property Name:\s*([^\n]+)")
    match = pattern.FIND_FIRST(text)
    
    IF match THEN
      logs.ADD("Property name extracted: " + match[1])
      RETURN match[1].TRIM()
    ELSE
      logs.ADD("Property name not found")
      RETURN "UNKNOWN"
    END IF
  END METHOD
  
  METHOD extractRegion(text: String, logs: Array) -> String
    // Pattern to find region code
    pattern = REGEX("Region:\s*([A-Z]{2})")
    match = pattern.FIND_FIRST(text)
    
    IF match THEN
      logs.ADD("Region extracted: " + match[1])
      RETURN match[1]
    ELSE
      logs.ADD("Region not found")
      RETURN "UNKNOWN"
    END IF
  END METHOD
  
  METHOD extractSuiteIdentifiers(text: String, logs: Array) -> Array<String>
    pattern = REGEX("(\d{6}-\d{3})")
    matches = pattern.FIND_ALL(text)
    uniqueIdentifiers = SET(matches).TO_ARRAY()
    
    logs.ADD("Found " + uniqueIdentifiers.LENGTH + " unique suite identifiers")
    RETURN uniqueIdentifiers
  END METHOD
  
  METHOD extractSuiteData(text: String, identifier: String, logs: Array) -> SuiteData
    parts = identifier.SPLIT("-")
    suiteId = parts[1]
    
    logs.ADD("Extracting data for suite: " + suiteId)
    
    // Extract financial charges
    baseRent = extractBaseRent(text, identifier, logs)
    cam = extractCAM(text, identifier, logs)
    ins = extractInsurance(text, identifier, logs)
    tax = extractTax(text, identifier, logs)
    
    // Calculate total
    totalDueMonth = baseRent + cam + ins + tax
    logs.ADD("Calculated Total Due/Month for suite " + suiteId + ": " + totalDueMonth)
    
    // Extract monthly payments
    monthlyPayments = extractMonthlyPayments(text, identifier, logs)
    
    // Build suite data
    suiteData = {
      suiteId: suiteId,
      charges: {
        baseRentMonth: baseRent,
        camMonth: cam,
        insMonth: ins,
        taxMonth: tax,
        totalDueMonth: totalDueMonth
      },
      balanceDue: 0,
      leaseTerms: {
        rentDueDate: null,
        lateAfter: null,
        lateFee: 0
      },
      monthlyPayments: monthlyPayments
    }
    
    RETURN suiteData
  END METHOD
  
  METHOD extractBaseRent(text: String, identifier: String, logs: Array) -> Number
    // Find "Rental Income BRR" row for this suite
    pattern = REGEX(identifier + ".*Rental Income BRR.*\$?([\d,]+\.?\d*)")
    match = pattern.FIND_FIRST(text)
    
    IF match THEN
      value = NumericCleanerUtil.cleanNumeric(match[1])
      logs.ADD("Base Rent for " + identifier + ": " + value)
      RETURN value
    ELSE
      logs.ADD("Base Rent not found for " + identifier + ", using 0")
      RETURN 0
    END IF
  END METHOD
  
  METHOD extractCAM(text: String, identifier: String, logs: Array) -> Number
    pattern = REGEX(identifier + ".*CAM Recovery - Billed.*\$?([\d,]+\.?\d*)")
    match = pattern.FIND_FIRST(text)
    
    IF match THEN
      value = NumericCleanerUtil.cleanNumeric(match[1])
      logs.ADD("CAM for " + identifier + ": " + value)
      RETURN value
    ELSE
      logs.ADD("CAM not found for " + identifier + ", using 0")
      RETURN 0
    END IF
  END METHOD
  
  METHOD extractInsurance(text: String, identifier: String, logs: Array) -> Number
    pattern = REGEX(identifier + ".*INS Recovery - Billed.*\$?([\d,]+\.?\d*)")
    match = pattern.FIND_FIRST(text)
    
    IF match THEN
      value = NumericCleanerUtil.cleanNumeric(match[1])
      logs.ADD("Insurance for " + identifier + ": " + value)
      RETURN value
    ELSE
      logs.ADD("Insurance not found for " + identifier + ", using 0")
      RETURN 0
    END IF
  END METHOD
  
  METHOD extractTax(text: String, identifier: String, logs: Array) -> Number
    pattern = REGEX(identifier + ".*RET Recovery - Billed.*\$?([\d,]+\.?\d*)")
    match = pattern.FIND_FIRST(text)
    
    IF match THEN
      value = NumericCleanerUtil.cleanNumeric(match[1])
      logs.ADD("Tax for " + identifier + ": " + value)
      RETURN value
    ELSE
      logs.ADD("Tax not found for " + identifier + ", using 0")
      RETURN 0
    END IF
  END METHOD
  
  METHOD extractMonthlyPayments(text: String, identifier: String, logs: Array) -> MonthlyPayments
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"]
    payments = {}
    
    FOR EACH month IN months DO
      pattern = REGEX(identifier + ".*" + month + ".*\$?([\d,]+\.?\d*)")
      match = pattern.FIND_FIRST(text)
      
      IF match THEN
        value = NumericCleanerUtil.cleanNumeric(match[1])
        payments[month.LOWERCASE()] = value
      ELSE
        payments[month.LOWERCASE()] = 0
      END IF
    END FOR
    
    logs.ADD("Extracted monthly payments for " + identifier)
    RETURN payments
  END METHOD
END CLASS
```

### 4. PdfParserUtil

**Responsibility**: Parse PDF buffer into text content

**Pseudocode**:
```
CLASS PdfParserUtil
  STATIC METHOD parsePdf(buffer: Buffer) -> String
    TRY
      data = AWAIT pdf-parse(buffer)
      RETURN data.text
    CATCH error
      THROW InternalServerErrorException("Failed to parse PDF: " + error.message)
    END TRY
  END METHOD
END CLASS
```

### 5. NumericCleanerUtil

**Responsibility**: Clean and convert string values to numbers

**Pseudocode**:
```
CLASS NumericCleanerUtil
  STATIC METHOD cleanNumeric(value: String) -> Number
    // Remove currency symbols, commas, and whitespace
    cleaned = value.REPLACE(/[$,\s]/g, "")
    
    // Convert to number
    number = PARSE_FLOAT(cleaned)
    
    IF IS_NAN(number) THEN
      RETURN 0
    END IF
    
    RETURN number
  END METHOD
END CLASS
```

### 6. PatternMatcherUtil

**Responsibility**: Centralized regex pattern matching with error handling

**Pseudocode**:
```
CLASS PatternMatcherUtil
  STATIC METHOD findFirst(text: String, pattern: RegExp) -> Match | null
    match = pattern.EXEC(text)
    RETURN match
  END METHOD
  
  STATIC METHOD findAll(text: String, pattern: RegExp) -> Array<String>
    matches = []
    match = pattern.EXEC(text)
    
    WHILE match != null DO
      matches.ADD(match[1])
      match = pattern.EXEC(text)
    END WHILE
    
    RETURN matches
  END METHOD
END CLASS
```

## Data Models

### ExtractionResultDto

```typescript
{
  propertyId: string
  propertyName: string
  region: string
  suites: SuiteDataDto[]
  createdAt: string (ISO 8601)
  updatedAt: string (ISO 8601)
  extractionLogs: string[]
}
```

### SuiteDataDto

```typescript
{
  suiteId: string
  charges: FinancialChargesDto
  balanceDue: number
  leaseTerms: LeaseTermsDto
  monthlyPayments: MonthlyPaymentsDto
}
```

### FinancialChargesDto

```typescript
{
  baseRentMonth: number
  camMonth: number
  insMonth: number
  taxMonth: number
  totalDueMonth: number
}
```

### LeaseTermsDto

```typescript
{
  rentDueDate: string | null
  lateAfter: string | null
  lateFee: number
}
```

### MonthlyPaymentsDto

```typescript
{
  jan: number
  feb: number
  mar: number
  apr: number
  may: number
  jun: number
  jul: number
  aug: number
  sept: number
  oct: number
  nov: number
  dec: number
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: PDF Parsing Success

*For any* valid PDF buffer, the parser should successfully extract text content without throwing exceptions.

**Validates: Requirements 1.1**

### Property 2: PDF Parsing Error Handling

*For any* invalid or corrupted PDF buffer, the parser should throw a descriptive error message rather than crashing.

**Validates: Requirements 1.2**

### Property 3: Suite Identifier Parsing

*For any* suite identifier in the format "PPPPPP-SSS", the extractor should correctly extract PPPPPP as the property ID and SSS as the suite ID.

**Validates: Requirements 3.1, 3.2**

### Property 4: Property ID Consistency

*For any* extraction result with multiple suites, all suites should have the same property ID derived from their identifiers.

**Validates: Requirements 2.4**

### Property 5: Numeric Value Cleaning

*For any* string containing currency symbols ($), commas, and whitespace, the numeric cleaner should remove all formatting and return a valid numeric value.

**Validates: Requirements 4.2, 5.2, 6.2, 7.2, 8.2**

### Property 6: Numeric Type Constraint

*For any* extracted financial value (base rent, CAM, insurance, tax, monthly payments, total due), the result should be a number type, not a string.

**Validates: Requirements 4.3, 5.3, 6.3, 7.3, 8.3, 9.2, 11.4**

### Property 7: Total Due Calculation

*For any* suite with extracted charges, the totalDueMonth should equal the sum of baseRentMonth + camMonth + insMonth + taxMonth.

**Validates: Requirements 9.1**

### Property 8: Monthly Payments Completeness

*For any* extraction result, each suite's monthlyPayments object should contain all 12 month fields (jan, feb, mar, apr, may, jun, jul, aug, sept, oct, nov, dec).

**Validates: Requirements 8.1**

### Property 9: JSON Structure Completeness

*For any* extraction result, the JSON should contain propertyId, propertyName, region, suites array, createdAt, and updatedAt fields.

**Validates: Requirements 11.1**

### Property 10: Suite Structure Completeness

*For any* suite in the extraction result, the suite object should contain suiteId, charges, balanceDue, leaseTerms, and monthlyPayments fields.

**Validates: Requirements 11.2**

### Property 11: ISO 8601 Timestamp Format

*For any* extraction result, the createdAt and updatedAt fields should be valid ISO 8601 formatted timestamp strings.

**Validates: Requirements 11.3**

### Property 12: Extraction Logs Presence

*For any* extraction result, the output should include an extractionLogs array with at least one log entry.

**Validates: Requirements 12.4**

### Property 13: Extraction Logs for Values

*For any* successfully extracted value, there should be a corresponding log entry describing how the value was extracted.

**Validates: Requirements 12.1**

### Property 14: Calculation Logs

*For any* calculated value (totalDueMonth, monthly payments), there should be a log entry showing the calculation formula.

**Validates: Requirements 12.2**

### Property 15: Error Logging

*For any* extraction failure or validation error, the error should be logged in the extractionLogs array.

**Validates: Requirements 12.3, 13.4**

### Property 16: Malformed Identifier Handling

*For any* suite identifier that doesn't match the "PPPPPP-SSS" format, the extractor should log an error and skip that suite without crashing.

**Validates: Requirements 3.3, 13.2**

### Property 17: HTTP Success Response

*For any* valid PDF that is successfully processed, the API should return HTTP 200 status with a JSON payload containing the extraction result.

**Validates: Requirements 14.2, 14.4**

### Property 18: HTTP Error Response

*For any* invalid input or extraction failure, the API should return an appropriate HTTP error status (400, 500) with an error message.

**Validates: Requirements 14.3**

### Property 19: Numeric Validation

*For any* extracted numeric value, the system should validate that the result is a valid number (not NaN or Infinity).

**Validates: Requirements 13.1**

### Property 20: Missing Field Warnings

*For any* required field that is missing from the PDF, the system should log a validation warning in the extractionLogs.

**Validates: Requirements 13.3**

## Error Handling

### PDF Parsing Errors

**Error Type**: `InternalServerErrorException`
**Trigger**: PDF buffer cannot be parsed by pdf-parse library
**Response**: HTTP 500 with error message "Failed to parse PDF: {error details}"
**Logging**: Log full error stack trace for debugging

### Invalid File Format

**Error Type**: `BadRequestException`
**Trigger**: Uploaded file is not a PDF (mimetype check fails)
**Response**: HTTP 400 with error message "Invalid file format. Expected application/pdf"
**Logging**: Log the received mimetype

### Missing Required Data

**Error Type**: Validation warning (not an exception)
**Trigger**: Required fields like property name or suite identifiers are not found
**Response**: Continue extraction with default values, include warnings in extractionLogs
**Logging**: Log each missing field with context

### Malformed Suite Identifiers

**Error Type**: Validation error (not an exception)
**Trigger**: Suite identifier doesn't match "PPPPPP-SSS" format
**Response**: Skip that suite, continue with others, include error in extractionLogs
**Logging**: Log the malformed identifier and the pattern it failed to match

### Numeric Conversion Errors

**Error Type**: Handled gracefully with default value
**Trigger**: Extracted value cannot be converted to a number
**Response**: Use 0 as default value, log the conversion failure
**Logging**: Log the original string value and the conversion attempt

### Empty PDF Content

**Error Type**: Validation warning
**Trigger**: PDF parses successfully but contains no text
**Response**: Return empty suites array with warnings in extractionLogs
**Logging**: Log that no content was found

## Testing Strategy

### Unit Testing

Unit tests will focus on specific examples, edge cases, and error conditions:

**Controller Tests**:
- Test file upload with valid PDF
- Test file upload with invalid mimetype
- Test file upload with null file
- Test response format and status codes

**Service Tests**:
- Test property ID extraction with known suite identifiers
- Test property name extraction with known patterns
- Test region extraction with known patterns
- Test suite data extraction with known PDF text
- Test calculation of totalDueMonth with known values
- Test handling of missing data fields
- Test error logging for malformed identifiers

**Utility Tests**:
- Test PDF parsing with sample PDF files
- Test numeric cleaning with various currency formats ($1,234.56, 1234.56, $1234)
- Test pattern matching with known text samples
- Test edge cases: empty strings, null values, special characters

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using the **fast-check** library (already available in package.json). Each test will run a minimum of 100 iterations.

**Configuration**:
- Library: fast-check
- Minimum iterations: 100 per property
- Tag format: `// Feature: foresight-pdf-extractor, Property {N}: {property text}`

**Property Test Coverage**:

1. **Property 1**: Generate random valid PDF buffers, verify parsing succeeds
   - Tag: `// Feature: foresight-pdf-extractor, Property 1: PDF Parsing Success`

2. **Property 2**: Generate random corrupted buffers, verify descriptive errors
   - Tag: `// Feature: foresight-pdf-extractor, Property 2: PDF Parsing Error Handling`

3. **Property 3**: Generate random suite identifiers in format "PPPPPP-SSS", verify correct parsing
   - Tag: `// Feature: foresight-pdf-extractor, Property 3: Suite Identifier Parsing`

4. **Property 4**: Generate extraction results with multiple suites, verify property ID consistency
   - Tag: `// Feature: foresight-pdf-extractor, Property 4: Property ID Consistency`

5. **Property 5**: Generate random currency strings, verify cleaning removes all formatting
   - Tag: `// Feature: foresight-pdf-extractor, Property 5: Numeric Value Cleaning`

6. **Property 6**: Generate extraction results, verify all financial values are numbers
   - Tag: `// Feature: foresight-pdf-extractor, Property 6: Numeric Type Constraint`

7. **Property 7**: Generate random charge values, verify totalDueMonth calculation
   - Tag: `// Feature: foresight-pdf-extractor, Property 7: Total Due Calculation`

8. **Property 8**: Generate extraction results, verify all 12 months present
   - Tag: `// Feature: foresight-pdf-extractor, Property 8: Monthly Payments Completeness`

9. **Property 9**: Generate extraction results, verify required top-level fields
   - Tag: `// Feature: foresight-pdf-extractor, Property 9: JSON Structure Completeness`

10. **Property 10**: Generate extraction results, verify required suite fields
    - Tag: `// Feature: foresight-pdf-extractor, Property 10: Suite Structure Completeness`

11. **Property 11**: Generate extraction results, verify ISO 8601 timestamp format
    - Tag: `// Feature: foresight-pdf-extractor, Property 11: ISO 8601 Timestamp Format`

12. **Property 12**: Generate extraction results, verify logs array exists
    - Tag: `// Feature: foresight-pdf-extractor, Property 12: Extraction Logs Presence`

13. **Property 13**: Generate extraction results, verify logs for extracted values
    - Tag: `// Feature: foresight-pdf-extractor, Property 13: Extraction Logs for Values`

14. **Property 14**: Generate extraction results with calculations, verify calculation logs
    - Tag: `// Feature: foresight-pdf-extractor, Property 14: Calculation Logs`

15. **Property 15**: Generate extraction failures, verify error logging
    - Tag: `// Feature: foresight-pdf-extractor, Property 15: Error Logging`

16. **Property 16**: Generate malformed identifiers, verify error handling
    - Tag: `// Feature: foresight-pdf-extractor, Property 16: Malformed Identifier Handling`

17. **Property 17**: Generate valid PDFs, verify HTTP 200 responses
    - Tag: `// Feature: foresight-pdf-extractor, Property 17: HTTP Success Response`

18. **Property 18**: Generate invalid inputs, verify HTTP error responses
    - Tag: `// Feature: foresight-pdf-extractor, Property 18: HTTP Error Response`

19. **Property 19**: Generate numeric extractions, verify valid numbers (not NaN/Infinity)
    - Tag: `// Feature: foresight-pdf-extractor, Property 19: Numeric Validation`

20. **Property 20**: Generate PDFs with missing fields, verify warning logs
    - Tag: `// Feature: foresight-pdf-extractor, Property 20: Missing Field Warnings`

### Integration Testing

Integration tests will verify the complete extraction pipeline:

- Upload a real ForeSight PDF sample and verify complete extraction
- Test with PDFs containing multiple suites
- Test with PDFs missing optional fields
- Test with PDFs containing special characters in property names
- Verify extraction logs contain expected entries
- Verify calculated values match manual calculations

### Test Data

**Sample PDFs**:
- Create mock ForeSight PDFs with known data for testing
- Include PDFs with 1 suite, multiple suites, missing data
- Include edge cases: special characters, large numbers, zero values

**Mock Data**:
- Mock PDF text content with known patterns
- Mock suite identifiers in various formats
- Mock financial data with known calculations

## Implementation Notes

### PDF Parsing Library

The design uses **pdf-parse** as the PDF parsing library. This needs to be added to package.json:

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

### Regex Patterns

The actual regex patterns will need to be refined based on the exact format of ForeSight PDFs. The design provides pseudocode patterns that should be adjusted during implementation based on real PDF samples.

### Performance Considerations

- PDF parsing can be memory-intensive for large files
- Consider adding file size limits (e.g., 10MB max)
- Consider adding timeout limits for parsing operations
- Cache parsed text if multiple extractions are needed from the same PDF

### Extensibility

The design is structured to allow easy addition of new extraction fields:
1. Add new extraction method to service
2. Add new field to DTO
3. Add new property test for the field
4. Update JSON schema documentation

### Swagger Documentation

The controller should include Swagger decorators for API documentation:
- `@ApiOperation()` for endpoint description
- `@ApiConsumes('multipart/form-data')` for file upload
- `@ApiBody()` for request schema
- `@ApiResponse()` for response schemas
- `@ApiTags('foresight-pdf-extractor')` for grouping

### Logging

Use NestJS Logger for consistent logging:
- Log all extraction attempts (success and failure)
- Log performance metrics (parsing time, extraction time)
- Log validation warnings and errors
- Use appropriate log levels (debug, info, warn, error)
