# Requirements Document

## Introduction

This document specifies the requirements for integrating DocuSign eSignature REST API into a NestJS-based Tenant Real Estate Management System. The integration enables electronic signature workflows for lease documents, allowing property managers to send lease PDFs to tenants for signature via DocuSign, receive webhook notifications upon completion, and automatically update lease status with signed documents.

## Glossary

- **DocuSign_Service**: The NestJS service responsible for authenticating with DocuSign API and managing envelope operations
- **Envelope**: A DocuSign container that holds documents, recipients, and signature tabs for a signing transaction
- **Webhook_Handler**: The NestJS controller endpoint that receives and processes DocuSign event notifications
- **Lease_Entity**: The database entity representing a lease agreement in the system
- **JWT_Authenticator**: The component responsible for obtaining DocuSign access tokens using JWT OAuth flow
- **Signature_Tab**: A DocuSign UI element placed on a document indicating where a recipient should sign
- **HMAC_Validator**: The component that verifies webhook authenticity using HMAC-SHA256 signature verification
- **Envelope_Status**: The current state of a DocuSign envelope (sent, delivered, completed, voided, declined)
- **Signed_Document**: The final PDF document containing all applied signatures from DocuSign

## Requirements

### Requirement 1: JWT OAuth Authentication

**User Story:** As a system administrator, I want the system to authenticate with DocuSign using JWT OAuth, so that API requests are securely authorized without user interaction.

#### Acceptance Criteria

1. WHEN the system starts, THE DocuSign_Service SHALL load credentials from environment variables (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY, DOCUSIGN_BASE_PATH)
2. WHEN an access token is needed, THE JWT_Authenticator SHALL generate a JWT assertion signed with the private key
3. WHEN the JWT assertion is generated, THE JWT_Authenticator SHALL request an access token from DocuSign OAuth endpoint
4. IF the access token request fails, THEN THE JWT_Authenticator SHALL log the error with details and throw an authentication exception
5. WHEN an access token is obtained, THE JWT_Authenticator SHALL cache the token until expiration minus 5 minutes
6. WHEN a cached token exists and is not expired, THE JWT_Authenticator SHALL reuse the cached token

### Requirement 2: Envelope Creation and Sending

**User Story:** As a property manager, I want to send lease documents to tenants for electronic signature, so that the signing process is fast and paperless.

#### Acceptance Criteria

1. WHEN a lease document send request is received with lease ID, THE DocuSign_Service SHALL retrieve the lease PDF from storage
2. WHEN the lease PDF is retrieved, THE DocuSign_Service SHALL retrieve tenant email address from the Lease_Entity
3. WHEN tenant information is available, THE DocuSign_Service SHALL create an envelope with the PDF document encoded in base64
4. WHEN creating the envelope, THE DocuSign_Service SHALL add the tenant as a signer recipient with their email address
5. WHEN adding the recipient, THE DocuSign_Service SHALL place a signHere tab at specified coordinates on the document
6. WHEN the envelope is configured, THE DocuSign_Service SHALL set envelope status to "sent" to trigger immediate delivery
7. WHEN the envelope is sent successfully, THE DocuSign_Service SHALL store the envelope ID in the Lease_Entity
8. IF envelope creation fails, THEN THE DocuSign_Service SHALL log the error and return a descriptive error response
9. WHEN the envelope is sent, THE DocuSign_Service SHALL return the envelope ID and status to the caller

### Requirement 3: Webhook Event Processing

**User Story:** As a system, I want to receive real-time notifications from DocuSign when envelope status changes, so that lease records stay synchronized automatically.

#### Acceptance Criteria

1. WHEN a webhook request is received, THE Webhook_Handler SHALL extract the HMAC signature from request headers
2. WHEN the HMAC signature is extracted, THE HMAC_Validator SHALL compute expected signature using the webhook secret and request body
3. IF the computed signature does not match the received signature, THEN THE Webhook_Handler SHALL reject the request with 401 Unauthorized
4. WHEN the webhook signature is valid, THE Webhook_Handler SHALL parse the envelope status from the request body
5. WHEN the envelope status is "completed", THE Webhook_Handler SHALL extract the envelope ID from the webhook payload
6. WHEN the envelope ID is extracted, THE Webhook_Handler SHALL find the corresponding Lease_Entity by envelope ID
7. IF no Lease_Entity is found for the envelope ID, THEN THE Webhook_Handler SHALL log a warning and return 200 OK
8. WHEN the Lease_Entity is found, THE Webhook_Handler SHALL update the lease status field to "SIGNED"
9. WHEN the lease status is updated, THE Webhook_Handler SHALL retrieve the Signed_Document from DocuSign API
10. WHEN the Signed_Document is retrieved, THE Webhook_Handler SHALL store the signed PDF in the system storage
11. WHEN all updates are complete, THE Webhook_Handler SHALL return 200 OK to acknowledge receipt
12. IF any processing error occurs after signature validation, THEN THE Webhook_Handler SHALL log the error and return 200 OK to prevent retries

### Requirement 4: Configuration Management

**User Story:** As a developer, I want DocuSign credentials managed through environment variables, so that sensitive data is not hardcoded and deployment is flexible.

#### Acceptance Criteria

1. THE System SHALL validate presence of DOCUSIGN_INTEGRATION_KEY environment variable at startup
2. THE System SHALL validate presence of DOCUSIGN_USER_ID environment variable at startup
3. THE System SHALL validate presence of DOCUSIGN_ACCOUNT_ID environment variable at startup
4. THE System SHALL validate presence of DOCUSIGN_PRIVATE_KEY environment variable at startup
5. THE System SHALL validate presence of DOCUSIGN_BASE_PATH environment variable at startup
6. IF any required environment variable is missing, THEN THE System SHALL throw a configuration error and prevent startup
7. WHEN environment variables are loaded, THE System SHALL make them available to the DocuSign_Service through NestJS ConfigService

### Requirement 5: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can diagnose issues quickly and ensure system reliability.

#### Acceptance Criteria

1. WHEN any DocuSign API call fails, THE DocuSign_Service SHALL log the error with request details and error response
2. WHEN authentication fails, THE JWT_Authenticator SHALL log the failure reason and throw a specific authentication exception
3. WHEN envelope creation fails, THE DocuSign_Service SHALL log the lease ID and failure details
4. WHEN webhook processing fails after signature validation, THE Webhook_Handler SHALL log the error but return 200 OK
5. WHEN a webhook is received with invalid signature, THE Webhook_Handler SHALL log the rejection with timestamp and source IP
6. WHEN successful operations complete, THE System SHALL log key events at info level (envelope sent, webhook received, lease updated)
7. THE System SHALL use NestJS Logger for all logging operations with appropriate log levels

### Requirement 6: API Endpoints

**User Story:** As a frontend developer, I want well-defined REST endpoints for DocuSign operations, so that I can integrate signature workflows into the UI.

#### Acceptance Criteria

1. THE System SHALL expose POST /leases/:id/send-for-signature endpoint
2. WHEN POST /leases/:id/send-for-signature is called, THE System SHALL validate the lease ID parameter
3. WHEN the lease ID is valid, THE System SHALL initiate the envelope creation and sending process
4. WHEN envelope sending succeeds, THE System SHALL return 200 OK with envelope ID and status
5. IF the lease ID does not exist, THEN THE System SHALL return 404 Not Found
6. IF envelope creation fails, THEN THE System SHALL return 500 Internal Server Error with error details
7. THE System SHALL expose POST /webhooks/docusign endpoint for receiving DocuSign events
8. WHEN POST /webhooks/docusign is called, THE System SHALL process the webhook according to Requirement 3
9. THE System SHALL not require authentication for POST /webhooks/docusign endpoint
10. THE System SHALL validate webhook authenticity using HMAC signature verification

### Requirement 7: Data Transfer Objects and Type Safety

**User Story:** As a developer, I want strongly-typed DTOs for all API operations, so that the codebase is maintainable and type-safe.

#### Acceptance Criteria

1. THE System SHALL define a SendForSignatureDto with validation decorators
2. THE System SHALL define a DocuSignWebhookDto for parsing webhook payloads
3. THE System SHALL define a DocuSignEnvelopeResponseDto for envelope creation responses
4. WHEN DTOs are used in controllers, THE System SHALL apply class-validator decorators for automatic validation
5. WHEN validation fails on incoming requests, THE System SHALL return 400 Bad Request with validation errors
6. THE System SHALL use TypeScript interfaces for internal DocuSign API response types

### Requirement 8: Testability and Local Development

**User Story:** As a developer, I want to test DocuSign integration locally, so that I can develop and debug without deploying to production.

#### Acceptance Criteria

1. THE System SHALL support ngrok or similar tunneling tools for local webhook testing
2. THE Documentation SHALL include instructions for configuring DocuSign webhook URLs with ngrok
3. THE System SHALL provide example environment variable configurations for development
4. WHERE local development mode is enabled, THE System SHALL log all webhook payloads for debugging
5. THE System SHALL be designed with dependency injection to allow mocking DocuSign API calls in tests

### Requirement 9: Document Storage Integration

**User Story:** As a system architect, I want signed documents stored consistently with existing document management, so that all lease documents are accessible from one location.

#### Acceptance Criteria

1. WHEN a Signed_Document is retrieved from DocuSign, THE System SHALL determine the storage strategy (S3 or database)
2. WHERE S3 storage is configured, THE System SHALL upload the signed PDF to S3 with a unique key
3. WHERE database storage is used, THE System SHALL store the signed PDF as binary data in the Lease_Entity
4. WHEN the signed PDF is stored, THE System SHALL update the Lease_Entity with the storage reference (S3 key or database ID)
5. WHEN storage operations fail, THE System SHALL log the error and retry up to 3 times with exponential backoff
6. THE System SHALL maintain consistency between lease status and document storage state

### Requirement 10: Security and Webhook Validation

**User Story:** As a security engineer, I want webhook requests validated cryptographically, so that only authentic DocuSign events are processed.

#### Acceptance Criteria

1. THE System SHALL retrieve the HMAC key from environment variable DOCUSIGN_WEBHOOK_SECRET
2. WHEN a webhook request is received, THE HMAC_Validator SHALL extract the X-DocuSign-Signature-1 header
3. WHEN computing the HMAC signature, THE HMAC_Validator SHALL use HMAC-SHA256 algorithm
4. WHEN computing the HMAC signature, THE HMAC_Validator SHALL use the raw request body as input
5. WHEN comparing signatures, THE HMAC_Validator SHALL use constant-time comparison to prevent timing attacks
6. IF signature validation fails, THEN THE System SHALL not process the webhook payload
7. THE System SHALL log all webhook validation attempts with success or failure status
