# Implementation Plan: DocuSign Integration

## Overview

This implementation plan breaks down the DocuSign integration into incremental, testable steps. Each task builds on previous work, starting with core infrastructure (module setup, configuration), then authentication, envelope operations, webhook handling, and finally integration with the leasing module. Testing tasks are included as optional sub-tasks to allow for faster MVP delivery while maintaining quality standards.

## Tasks

- [x] 1. Set up DocuSign module structure and configuration
  - Create `src/modules/integration/docusign/` directory structure
  - Create `docusign.module.ts` with NestJS module definition
  - Create configuration interface in `interfaces/docusign-config.interface.ts`
  - Add environment variable validation in module initialization
  - Update `.env.example` with DocuSign configuration variables
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 1.1 Write unit tests for configuration validation
  - Test startup with missing environment variables
  - Test startup with valid configuration
  - Verify configuration error messages
  - _Requirements: 4.6_

- [x] 2. Implement JWT authentication service
  - [x] 2.1 Create JWT authentication logic in `docusign.service.ts`
    - Implement `generateJwtAssertion()` method with RS256 signing
    - Implement `getAccessToken()` method with DocuSign OAuth endpoint call
    - Add token caching with expiration tracking (expiration - 5 minutes)
    - _Requirements: 1.2, 1.3, 1.5, 1.6_
  
  - [x] 2.2 Write property test for JWT token generation
    - **Property 1: JWT Token Generation**
    - **Validates: Requirements 1.2**
  
  - [x] 2.3 Write property test for token caching and reuse
    - **Property 2: Token Caching and Reuse**
    - **Validates: Requirements 1.5, 1.6**
  
  - [x] 2.4 Write property test for authentication error handling
    - **Property 3: Authentication Error Handling**
    - **Validates: Requirements 1.4**
  
  - [x] 2.5 Write unit tests for authentication edge cases
    - Test with invalid private key format
    - Test with network timeout
    - Test token refresh before expiration
    - _Requirements: 1.4_

- [x] 3. Checkpoint - Verify authentication works
  - Ensure authentication tests pass
  - Manually test JWT generation with DocuSign demo environment
  - Ask the user if questions arise

- [x] 4. Implement envelope creation and sending
  - [x] 4.1 Create DTOs for envelope operations
    - Create `dto/send-for-signature.dto.ts` with validation decorators
    - Create `dto/envelope-response.dto.ts` for API responses
    - Create `interfaces/envelope-definition.interface.ts` for DocuSign API types
    - _Requirements: 7.1, 7.3, 7.6_
  
  - [x] 4.2 Write unit tests for DTO validation
    - Test SendForSignatureDto with invalid inputs
    - Test validation error responses
    - _Requirements: 7.4, 7.5_
  
  - [x] 4.3 Implement envelope creation in DocuSignService
    - Implement `buildEnvelopeDefinition()` method
    - Implement `sendLeaseForSignature()` method
    - Add PDF base64 encoding logic
    - Add recipient and signHere tab configuration
    - Integrate with leasing module to retrieve lease data
    - Store envelope ID in Lease entity
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9_
  
  - [x] 4.4 Write property test for envelope structure completeness
    - **Property 4: Envelope Structure Completeness**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
  
  - [x] 4.5 Write property test for envelope ID persistence
    - **Property 5: Envelope ID Persistence**
    - **Validates: Requirements 2.7, 2.9**
  
  - [x] 4.6 Write property test for envelope creation error handling
    - **Property 6: Envelope Creation Error Handling**
    - **Validates: Requirements 2.8**
  
  - [x] 4.7 Write unit tests for envelope creation scenarios
    - Test with missing lease
    - Test with missing PDF
    - Test with invalid tenant email
    - _Requirements: 2.8_

- [x] 5. Extend Lease entity with DocuSign fields
  - Add `docusignEnvelopeId` field to Lease schema
  - Add `signatureStatus` enum field (DRAFT, PENDING_SIGNATURE, SIGNED, VOIDED)
  - Add `signedDocumentUrl` field for storage reference
  - Add `sentForSignatureAt` and `signedAt` timestamp fields
  - Run database migration if needed
  - _Requirements: 2.7, 3.8, 9.4_

- [-] 6. Implement API endpoint for sending leases for signature
  - [x] 6.1 Create controller endpoint POST /leases/:id/send-for-signature
    - Create `docusign.controller.ts` with endpoint definition
    - Add parameter validation for lease ID
    - Call DocuSignService.sendLeaseForSignature()
    - Return envelope response with proper status codes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ] 6.2 Write property tests for API endpoint validation
    - **Property 13: API Endpoint Parameter Validation**
    - **Validates: Requirements 6.2, 6.5**
  
  - [ ] 6.3 Write property test for API success response structure
    - **Property 14: API Success Response Structure**
    - **Validates: Requirements 6.4**
  
  - [ ] 6.4 Write property test for API error response structure
    - **Property 15: API Error Response Structure**
    - **Validates: Requirements 6.6**
  
  - [ ] 6.5 Write integration tests for send-for-signature endpoint
    - Test successful envelope creation flow
    - Test with non-existent lease ID
    - Test with DocuSign API failure
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

- [x] 7. Checkpoint - Verify envelope sending works
  - Ensure envelope creation tests pass
  - Manually test sending a lease document to DocuSign demo
  - Verify envelope appears in DocuSign account
  - Ask the user if questions arise

- [x] 8. Implement HMAC signature validation guard
  - [x] 8.1 Create HmacValidationGuard
    - Create `guards/hmac-validation.guard.ts`
    - Implement HMAC-SHA256 signature computation
    - Implement constant-time signature comparison
    - Extract X-DocuSign-Signature-1 header
    - Add logging for validation attempts
    - _Requirements: 3.1, 3.2, 3.3, 10.1, 10.2, 10.3, 10.4, 10.7_
  
  - [x] 8.2 Write property test for HMAC signature validation
    - **Property 7: HMAC Signature Validation**
    - **Validates: Requirements 3.2, 3.3, 10.3, 10.4**
  
  - [x] 8.3 Write property test for webhook validation logging
    - **Property 20: Webhook Validation Logging**
    - **Validates: Requirements 10.7**
  
  - [x] 8.4 Write unit tests for HMAC validation edge cases
    - Test with missing signature header
    - Test with tampered request body
    - Test with wrong webhook secret
    - _Requirements: 3.3, 5.5_

- [x] 9. Configure NestJS to preserve raw request body
  - Update `main.ts` to add body-parser middleware with verify callback
  - Store raw body buffer in request object for HMAC validation
  - Ensure JSON parsing still works for other endpoints
  - _Requirements: 3.2, 10.4_

- [-] 10. Implement webhook event processing
  - [x] 10.1 Create webhook DTO and endpoint
    - Create `dto/docusign-webhook.dto.ts` with webhook payload structure
    - Add POST /webhooks/docusign endpoint to controller
    - Apply HmacValidationGuard to webhook endpoint
    - Exclude webhook endpoint from authentication requirements
    - _Requirements: 6.7, 6.9, 7.2_
  
  - [ ] 10.2 Write unit tests for webhook DTO parsing
    - Test with valid DocuSign webhook payloads
    - Test with malformed payloads
    - _Requirements: 7.2_
  
  - [x] 10.3 Implement webhook processing logic in DocuSignService
    - Implement `handleWebhookEvent()` method
    - Parse envelope status from webhook payload
    - Filter for "completed" status events
    - Find lease by envelope ID
    - Handle missing lease gracefully (log warning, return 200)
    - _Requirements: 3.4, 3.5, 3.6, 3.7_
  
  - [x] 10.4 Implement signed document retrieval
    - Implement `getSignedDocument()` method
    - Call DocuSign API to download signed PDF
    - Handle API errors gracefully
    - _Requirements: 3.9_
  
  - [x] 10.5 Implement document storage logic
    - Determine storage strategy (S3 vs database) from configuration
    - Implement S3 upload with unique key generation
    - Implement database storage as binary data
    - Add retry logic with exponential backoff (3 attempts)
    - Update lease with storage reference
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 10.6 Implement lease status update
    - Update lease signatureStatus to "SIGNED"
    - Set signedAt timestamp
    - Ensure consistency between status and document reference
    - _Requirements: 3.8, 9.6_
  
  - [ ] 10.7 Write property test for webhook processing flow
    - **Property 8: Webhook Processing for Completed Envelopes**
    - **Validates: Requirements 3.4, 3.5, 3.6, 3.8, 3.9, 3.10, 3.11**
  
  - [ ] 10.8 Write property test for webhook idempotent error handling
    - **Property 9: Webhook Idempotent Error Handling**
    - **Validates: Requirements 3.7, 3.12**
  
  - [ ] 10.9 Write property test for storage strategy selection
    - **Property 17: Storage Strategy Selection**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
  
  - [ ] 10.10 Write property test for storage retry logic
    - **Property 18: Storage Retry Logic**
    - **Validates: Requirements 9.5**
  
  - [ ] 10.11 Write property test for lease status consistency invariant
    - **Property 19: Lease Status and Document Consistency**
    - **Validates: Requirements 9.6**
  
  - [ ] 10.12 Write unit tests for webhook processing scenarios
    - Test with non-completed envelope status
    - Test with missing lease
    - Test with document retrieval failure
    - Test with storage failure
    - _Requirements: 3.7, 3.12_

- [ ] 11. Implement comprehensive error handling and logging
  - [ ] 11.1 Add error logging throughout DocuSignService
    - Log authentication failures with details
    - Log envelope creation failures with lease ID
    - Log webhook processing errors
    - Log invalid webhook signatures with timestamp and IP
    - Use appropriate log levels (error, warn, info)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 11.2 Add success event logging
    - Log envelope sent events
    - Log webhook received events
    - Log lease status updates
    - Use info log level for success events
    - _Requirements: 5.6_
  
  - [ ] 11.3 Write property test for comprehensive error logging
    - **Property 11: Comprehensive Error Logging**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
  
  - [ ] 11.4 Write property test for success event logging
    - **Property 12: Success Event Logging**
    - **Validates: Requirements 5.6**

- [x] 12. Checkpoint - Verify webhook processing works
  - Ensure webhook tests pass
  - Set up ngrok tunnel for local testing
  - Configure DocuSign Connect webhook URL
  - Send test envelope and verify webhook delivery
  - Verify lease status updates correctly
  - Ask the user if questions arise

- [ ] 13. Add property-based test for configuration validation
  - [ ] 13.1 Write property test for configuration validation at startup
    - **Property 10: Configuration Validation at Startup**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

- [ ] 14. Add property-based test for DTO validation
  - [ ] 14.1 Write property test for DTO validation behavior
    - **Property 16: DTO Validation Behavior**
    - **Validates: Requirements 7.4, 7.5**

- [ ] 15. Wire everything together and update module exports
  - Export DocuSignService from DocuSignModule
  - Import DocuSignModule in LeasingModule
  - Update app.module.ts to include DocuSignModule
  - Verify all dependencies are properly injected
  - _Requirements: All_

- [x] 16. Create development documentation
  - Document environment variable setup
  - Document ngrok configuration for local webhook testing
  - Add example .env.development file
  - Document API endpoint usage
  - Add troubleshooting guide
  - _Requirements: 8.2, 8.3_

- [ ] 17. Final checkpoint - End-to-end integration test
  - Run all tests (unit, property, integration)
  - Verify test coverage meets goals (>80% line, >75% branch)
  - Perform manual end-to-end test: send lease → sign in DocuSign → verify webhook → check lease status
  - Verify all 20 correctness properties are tested
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows clean architecture with proper separation of concerns
- All external dependencies (DocuSign API, storage) are injected for testability
