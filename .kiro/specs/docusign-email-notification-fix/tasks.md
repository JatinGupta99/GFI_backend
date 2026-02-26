# Implementation Plan: DocuSign Signing URL in API Response

## Overview

This implementation adds the recipient signing URL to the API response when creating DocuSign envelopes. The approach is to extend the existing envelope creation flow by calling the DocuSign Recipient View API after successful envelope creation, then including the generated URL in the response. Error handling ensures that URL generation failures don't affect envelope creation.

## Tasks

- [x] 1. Update EnvelopeResponseDto to include signing URL field
  - Add optional `signingUrl` property of type string to the DTO
  - Add `@IsOptional()` and `@IsString()` decorators for validation
  - Ensure backward compatibility with existing fields
  - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4_

- [ ]* 1.1 Write unit tests for EnvelopeResponseDto validation
  - Test valid signing URL string
  - Test null and undefined signing URL
  - Test that all required fields are present
  - _Requirements: 3.3, 3.4_

- [ ]* 1.2 Write property test for DTO validation
  - **Property 3: DTO Validation for Signing URL**
  - **Validates: Requirements 2.4, 3.3**

- [ ]* 1.3 Write property test for backward compatibility
  - **Property 4: Backward Compatibility of Response Fields**
  - **Validates: Requirements 3.4**

- [x] 2. Create interfaces for recipient view request and response
  - Create `RecipientViewRequest` interface with returnUrl, authenticationMethod, email, userName, and optional clientUserId
  - Create `RecipientViewResponse` interface with url property
  - Add these interfaces to the docusign.service.ts file or a separate interfaces file
  - _Requirements: 1.2, 4.1, 4.2, 4.3_

- [x] 3. Add environment configuration for return URL
  - Add `DOCUSIGN_RETURN_URL` to .env.example with documentation
  - Document the default value in comments
  - Update any configuration documentation
  - _Requirements: 4.1_

- [x] 4. Implement generateRecipientViewUrl method in DocuSignService
  - [x] 4.1 Create private method signature with parameters: envelopeId, recipientEmail, recipientName
    - Return type should be `Promise<string | null>`
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 4.2 Build recipient view request object
    - Get return URL from config or use default
    - Set authenticationMethod to 'email'
    - Include recipient email and name
    - _Requirements: 1.2, 4.1, 4.2, 4.3_
  
  - [x] 4.3 Implement API call to DocuSign recipient view endpoint
    - Use POST /v2.1/accounts/{accountId}/envelopes/{envelopeId}/views/recipient
    - Include access token in Authorization header
    - Parse response to extract URL
    - _Requirements: 1.1, 1.3_
  
  - [x] 4.4 Add error handling with try-catch
    - Log errors with envelope ID and recipient email
    - Return null on failure instead of throwing
    - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.4_
  
  - [x] 4.5 Add comprehensive logging
    - Log before making request (envelope ID and recipient email)
    - Log success with URL (or truncated version)
    - Log errors with full context
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 4.6 Write property test for recipient view generation
  - **Property 1: Recipient View Generation with Correct Parameters**
  - **Validates: Requirements 1.1, 1.2, 1.3, 4.1, 4.3**

- [ ]* 4.7 Write unit tests for error handling
  - Test that API failures return null
  - Test that errors are logged with context
  - Test that no exceptions are thrown
  - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.4_

- [ ]* 4.8 Write property test for error resilience
  - **Property 5: Error Handling Preserves Envelope Creation**
  - **Validates: Requirements 1.4, 5.1, 5.2, 5.3, 5.4**

- [x] 5. Update sendLeaseForSignature method to call generateRecipientViewUrl
  - [x] 5.1 Call generateRecipientViewUrl after successful envelope creation
    - Pass envelope ID, recipient email, and recipient name
    - Wrap in try-catch to ensure failures don't affect envelope creation
    - _Requirements: 1.1, 1.4_
  
  - [x] 5.2 Add signing URL to EnvelopeResponseDto
    - Set signingUrl property if URL generation succeeds
    - Leave undefined if URL generation fails
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 5.3 Add logging for URL inclusion in response
    - Log success message when URL is included
    - _Requirements: 6.3_

- [ ]* 5.4 Write property test for API response structure
  - **Property 2: API Response Structure Based on URL Generation Success**
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ]* 5.5 Write property test for logging completeness
  - **Property 6: Comprehensive Logging for URL Generation**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 6. Checkpoint - Ensure all tests pass
  - Run all unit tests and property tests
  - Verify envelope creation still works
  - Verify signing URL is included in response
  - Ask the user if questions arise

- [ ]* 7. Write integration tests for complete flow
  - Test successful envelope creation with signing URL
  - Test envelope creation when URL generation fails
  - Test with custom and default return URLs
  - Mock DocuSign API responses
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Run complete test suite
  - Verify all requirements are met
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Error handling is designed to be fail-safe: envelope creation always succeeds even if URL generation fails
- The signing URL is an enhancement to the existing flow and doesn't change core functionality
