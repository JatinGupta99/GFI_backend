# Design Document: DocuSign Integration

## Overview

This design implements a DocuSign eSignature integration for a NestJS-based Tenant Real Estate Management System. The integration follows clean architecture principles with a dedicated module containing a service layer for DocuSign API operations, a controller for webhook handling, and proper separation of concerns.

The system uses JWT OAuth for authentication, creates envelopes with lease PDFs for tenant signatures, receives webhook notifications when signing is complete, and automatically updates lease status with signed documents.

### Key Design Decisions

1. **JWT OAuth over Authorization Code Grant**: JWT authentication enables server-to-server communication without user interaction, suitable for automated lease workflows
2. **Webhook-driven updates**: Real-time webhook notifications ensure immediate lease status updates without polling
3. **HMAC signature verification**: Cryptographic validation prevents unauthorized webhook requests
4. **Token caching**: Access tokens are cached to minimize authentication overhead
5. **Idempotent webhook processing**: Webhook handler returns 200 OK even on processing errors to prevent DocuSign retries
6. **Dependency injection**: All external dependencies are injected for testability

## Architecture

### Module Structure

```
src/modules/integration/docusign/
├── docusign.module.ts          # NestJS module definition
├── docusign.service.ts         # Core DocuSign API operations
├── docusign.controller.ts      # Webhook endpoint handler
├── dto/
│   ├── send-for-signature.dto.ts
│   ├── docusign-webhook.dto.ts
│   └── envelope-response.dto.ts
├── interfaces/
│   ├── docusign-config.interface.ts
│   └── envelope-definition.interface.ts
└── guards/
    └── hmac-validation.guard.ts
```

### Integration Points

- **Leasing Module**: Provides lease entity access and status updates
- **Media/Storage Module**: Handles PDF retrieval and signed document storage
- **Config Module**: Supplies DocuSign credentials from environment variables
- **Logger**: NestJS Winston logger for structured logging

### Data Flow

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Leasing Controller
    participant DS as DocuSign Service
    participant DocuSign as DocuSign API
    participant WH as Webhook Handler
    participant DB as Database

    UI->>API: POST /leases/:id/send-for-signature
    API->>DS: sendLeaseForSignature(leaseId)
    DS->>DB: Retrieve lease and PDF
    DS->>DS: Authenticate with JWT
    DS->>DocuSign: Create envelope with PDF
    DocuSign-->>DS: Envelope ID
    DS->>DB: Store envelope ID in lease
    DS-->>API: Envelope response
    API-->>UI: Success response

    Note over DocuSign,WH: Tenant signs document

    DocuSign->>WH: POST /webhooks/docusign (envelope.completed)
    WH->>WH: Validate HMAC signature
    WH->>DB: Find lease by envelope ID
    WH->>DocuSign: Retrieve signed PDF
    WH->>DB: Update lease status to SIGNED
    WH->>DB: Store signed PDF
    WH-->>DocuSign: 200 OK
```

## Components and Interfaces

### DocuSignService

The core service responsible for DocuSign API interactions.

**Dependencies:**
- `ConfigService`: Access to environment variables
- `HttpService`: HTTP client for DocuSign API calls
- `LeasingService`: Lease entity operations
- `MediaService`: PDF storage and retrieval
- `Logger`: Structured logging

**Methods:**

```typescript
class DocuSignService {
  // Authenticate and get access token (cached)
  async getAccessToken(): Promise<string>
  
  // Create and send envelope for lease signature
  async sendLeaseForSignature(leaseId: string): Promise<EnvelopeResponse>
  
  // Retrieve signed document from DocuSign
  async getSignedDocument(envelopeId: string): Promise<Buffer>
  
  // Build envelope definition from lease data
  private buildEnvelopeDefinition(lease: Lease, pdfBase64: string): EnvelopeDefinition
  
  // Generate JWT assertion for authentication
  private generateJwtAssertion(): string
}
```

**Authentication Flow:**

1. Check if cached token exists and is valid (expiration > 5 minutes)
2. If no valid token, generate JWT assertion:
   - Header: `{ alg: 'RS256', typ: 'JWT' }`
   - Payload: `{ iss: integrationKey, sub: userId, aud: 'account-d.docusign.com', iat: now, exp: now + 3600, scope: 'signature impersonation' }`
   - Sign with RSA private key
3. POST to `{basePath}/oauth/token` with grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
4. Cache token with expiration timestamp
5. Return access token

**Envelope Creation:**

```typescript
interface EnvelopeDefinition {
  emailSubject: string;
  documents: [{
    documentBase64: string;
    name: string;
    fileExtension: 'pdf';
    documentId: '1';
  }];
  recipients: {
    signers: [{
      email: string;
      name: string;
      recipientId: '1';
      routingOrder: '1';
      tabs: {
        signHereTabs: [{
          documentId: '1';
          pageNumber: '1';
          xPosition: '100';
          yPosition: '200';
        }];
      };
    }];
  };
  status: 'sent';
}
```

### DocuSignController

Handles incoming webhook requests from DocuSign.

**Endpoints:**

```typescript
@Controller('webhooks')
class DocuSignController {
  @Post('docusign')
  @UseGuards(HmacValidationGuard)
  async handleWebhook(@Body() payload: DocuSignWebhookDto): Promise<void>
}
```

**Webhook Processing Logic:**

1. Guard validates HMAC signature (see HmacValidationGuard)
2. Extract envelope status from payload
3. If status !== 'completed', log and return 200 OK
4. Extract envelope ID from payload
5. Query database for lease with matching envelope ID
6. If no lease found, log warning and return 200 OK
7. Retrieve signed document from DocuSign API
8. Store signed PDF in storage (S3 or database)
9. Update lease status to 'SIGNED'
10. Update lease with signed document reference
11. Return 200 OK (even if steps 7-10 fail, to prevent retries)

### HmacValidationGuard

NestJS guard that validates webhook authenticity.

```typescript
@Injectable()
class HmacValidationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-docusign-signature-1'];
    const body = request.rawBody; // Raw body buffer
    
    const secret = this.configService.get('DOCUSIGN_WEBHOOK_SECRET');
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64');
    
    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  }
}
```

**Note:** NestJS must be configured to preserve raw body for HMAC validation:

```typescript
// main.ts
app.use(json({ 
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
```

### Data Transfer Objects

**SendForSignatureDto:**

```typescript
class SendForSignatureDto {
  @IsString()
  @IsNotEmpty()
  leaseId: string;
  
  @IsEmail()
  @IsOptional()
  recipientEmail?: string; // Override tenant email if provided
  
  @IsObject()
  @IsOptional()
  signaturePosition?: {
    pageNumber: number;
    xPosition: number;
    yPosition: number;
  };
}
```

**DocuSignWebhookDto:**

```typescript
class DocuSignWebhookDto {
  @IsString()
  event: string; // 'envelope-completed', 'envelope-sent', etc.
  
  @IsString()
  apiVersion: string;
  
  @IsString()
  uri: string;
  
  @IsNumber()
  retryCount: number;
  
  @IsString()
  generatedDateTime: string;
  
  @ValidateNested()
  data: {
    accountId: string;
    userId: string;
    envelopeId: string;
    envelopeSummary: {
      status: string;
      emailSubject: string;
      envelopeId: string;
      recipients: any;
    };
  };
}
```

**EnvelopeResponseDto:**

```typescript
class EnvelopeResponseDto {
  @IsString()
  envelopeId: string;
  
  @IsString()
  status: string; // 'sent', 'delivered', 'completed'
  
  @IsString()
  statusDateTime: string;
  
  @IsString()
  uri: string;
}
```

## Data Models

### Lease Entity Extension

The existing Lease entity needs to be extended with DocuSign-related fields:

```typescript
@Schema()
class Lease {
  // ... existing fields
  
  @Prop({ type: String, required: false })
  docusignEnvelopeId?: string;
  
  @Prop({ type: String, enum: ['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'VOIDED'], default: 'DRAFT' })
  signatureStatus: string;
  
  @Prop({ type: String, required: false })
  signedDocumentUrl?: string; // S3 URL or database reference
  
  @Prop({ type: Date, required: false })
  sentForSignatureAt?: Date;
  
  @Prop({ type: Date, required: false })
  signedAt?: Date;
}
```

### Configuration Interface

```typescript
interface DocuSignConfig {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  basePath: string;
  webhookSecret: string;
}
```

## Correctness Properties


A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: JWT Token Generation

*For any* valid DocuSign configuration with integration key, user ID, and private key, when an access token is needed, the generated JWT assertion should be properly formatted with correct header (RS256), payload (iss, sub, aud, iat, exp, scope), and valid RSA signature.

**Validates: Requirements 1.2**

### Property 2: Token Caching and Reuse

*For any* obtained access token with expiration time, the token should be cached and reused for all subsequent requests until expiration minus 5 minutes, without making additional authentication requests.

**Validates: Requirements 1.5, 1.6**

### Property 3: Authentication Error Handling

*For any* authentication failure (invalid credentials, network error, or API rejection), the JWT_Authenticator should log the error with details and throw an authentication exception.

**Validates: Requirements 1.4**

### Property 4: Envelope Structure Completeness

*For any* lease with valid PDF and tenant email, the created envelope definition should contain: base64-encoded document, tenant as signer recipient with email, signHere tab at specified coordinates, and status set to "sent".

**Validates: Requirements 2.3, 2.4, 2.5, 2.6**

### Property 5: Envelope ID Persistence

*For any* successfully created envelope, the envelope ID should be stored in the corresponding Lease_Entity and the response should contain both envelope ID and status.

**Validates: Requirements 2.7, 2.9**

### Property 6: Envelope Creation Error Handling

*For any* envelope creation failure, the DocuSign_Service should log the error with lease ID and failure details, and return a descriptive error response to the caller.

**Validates: Requirements 2.8**

### Property 7: HMAC Signature Validation

*For any* webhook request, the computed HMAC-SHA256 signature using the webhook secret and raw request body should match the X-DocuSign-Signature-1 header value for the request to be accepted; mismatched signatures should result in 401 Unauthorized.

**Validates: Requirements 3.2, 3.3, 10.3, 10.4**

### Property 8: Webhook Processing for Completed Envelopes

*For any* webhook with valid signature and envelope status "completed", the system should: extract envelope ID, find corresponding lease, update status to "SIGNED", retrieve signed document from DocuSign, store the PDF, and return 200 OK.

**Validates: Requirements 3.4, 3.5, 3.6, 3.8, 3.9, 3.10, 3.11**

### Property 9: Webhook Idempotent Error Handling

*For any* webhook processing error that occurs after signature validation (missing lease, storage failure, API error), the system should log the error and return 200 OK to prevent DocuSign retries.

**Validates: Requirements 3.7, 3.12**

### Property 10: Configuration Validation at Startup

*For any* system startup, all required environment variables (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY, DOCUSIGN_BASE_PATH, DOCUSIGN_WEBHOOK_SECRET) should be validated for presence; missing variables should throw a configuration error and prevent startup.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

### Property 11: Comprehensive Error Logging

*For any* error condition (API failure, authentication failure, envelope creation failure, webhook processing failure, invalid signature), the system should log the error with appropriate context (request details, error response, timestamp, source IP where applicable) at the appropriate log level.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 12: Success Event Logging

*For any* successful operation (envelope sent, webhook received, lease updated), the system should log the event at info level with key details.

**Validates: Requirements 5.6**

### Property 13: API Endpoint Parameter Validation

*For any* request to POST /leases/:id/send-for-signature with invalid lease ID format, the system should fail validation and return an error; for non-existent lease IDs, the system should return 404 Not Found.

**Validates: Requirements 6.2, 6.5**

### Property 14: API Success Response Structure

*For any* successful envelope sending operation, the response should be 200 OK and contain envelope ID and status fields.

**Validates: Requirements 6.4**

### Property 15: API Error Response Structure

*For any* envelope creation failure, the system should return 500 Internal Server Error with error details.

**Validates: Requirements 6.6**

### Property 16: DTO Validation Behavior

*For any* incoming request with invalid DTO data (missing required fields, wrong types, invalid formats), the class-validator decorators should trigger validation failure and the system should return 400 Bad Request with validation errors.

**Validates: Requirements 7.4, 7.5**

### Property 17: Storage Strategy Selection

*For any* signed document retrieved from DocuSign, the system should determine and execute the appropriate storage strategy (S3 with unique key or database as binary data) based on configuration, and update the Lease_Entity with the storage reference.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 18: Storage Retry Logic

*For any* storage operation failure, the system should log the error and retry up to 3 times with exponential backoff before giving up.

**Validates: Requirements 9.5**

### Property 19: Lease Status and Document Consistency

*For any* lease in the system, if the signature status is "SIGNED", then a signed document reference (S3 URL or database ID) must exist; this invariant should be maintained across all operations.

**Validates: Requirements 9.6**

### Property 20: Webhook Validation Logging

*For any* webhook validation attempt (success or failure), the system should create a log entry with validation result, timestamp, and relevant request metadata.

**Validates: Requirements 10.7**

## Error Handling

### Error Categories

1. **Authentication Errors**
   - Invalid credentials: Throw `DocuSignAuthenticationException` with details
   - Token expiration: Automatically refresh token transparently
   - Network errors: Log and throw with retry suggestion

2. **Envelope Creation Errors**
   - Missing lease: Throw `LeaseNotFoundException`
   - Missing PDF: Throw `DocumentNotFoundException`
   - Invalid recipient: Throw `InvalidRecipientException`
   - DocuSign API errors: Log full error response and throw `EnvelopeCreationException`

3. **Webhook Processing Errors**
   - Invalid signature: Return 401 Unauthorized immediately
   - Missing lease: Log warning, return 200 OK (idempotent)
   - Document retrieval failure: Log error, return 200 OK (idempotent)
   - Storage failure: Log error, retry 3 times, return 200 OK (idempotent)

4. **Configuration Errors**
   - Missing environment variables: Throw at startup with clear message
   - Invalid private key format: Throw at startup with validation error

### Error Response Format

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  details?: any; // Additional context for debugging
}
```

### Retry Strategy

- **Authentication failures**: No automatic retry (fail fast)
- **Envelope creation**: No automatic retry (user-initiated)
- **Document storage**: 3 retries with exponential backoff (1s, 2s, 4s)
- **Webhook processing**: No retry (return 200 OK to prevent DocuSign retries)

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

**Library**: Use `fast-check` for TypeScript property-based testing

**Configuration**: Each property test should run minimum 100 iterations

**Test Tagging**: Each property test must include a comment referencing the design property:
```typescript
// Feature: docusign-integration, Property 2: Token Caching and Reuse
```

**Property Test Examples**:

1. **JWT Token Generation (Property 1)**
   - Generate random valid configurations
   - Verify JWT structure and signature validity
   - Check all required claims are present

2. **Token Caching (Property 2)**
   - Generate random token expiration times
   - Verify cache hit/miss behavior
   - Verify no re-authentication within cache window

3. **Envelope Structure (Property 4)**
   - Generate random lease data and PDFs
   - Verify envelope contains all required fields
   - Verify base64 encoding is correct

4. **HMAC Validation (Property 7)**
   - Generate random webhook payloads
   - Verify signature computation matches expected
   - Verify tampered payloads are rejected

5. **Lease Consistency Invariant (Property 19)**
   - Generate random lease states
   - Verify SIGNED status always has document reference
   - Verify invariant holds after all operations

### Unit Testing

**Focus Areas**:
- Configuration loading with specific valid/invalid examples
- Envelope creation with specific lease data
- Webhook processing with specific DocuSign payloads
- Error handling with specific failure scenarios
- DTO validation with specific invalid inputs

**Test Structure**:
```typescript
describe('DocuSignService', () => {
  describe('sendLeaseForSignature', () => {
    it('should create envelope with correct structure', async () => {
      // Specific example test
    });
    
    it('should handle missing lease gracefully', async () => {
      // Error condition test
    });
  });
});
```

### Integration Testing

**Scenarios**:
1. End-to-end envelope creation flow with mocked DocuSign API
2. Webhook processing with real webhook payload examples
3. HMAC validation with known good/bad signatures
4. Storage integration with mocked S3/database

**Tools**:
- `@nestjs/testing` for module testing
- `supertest` for HTTP endpoint testing
- `nock` for mocking DocuSign API calls

### Local Development Testing

**Webhook Testing with ngrok**:
1. Start NestJS application locally
2. Run `ngrok http 3000` to create public tunnel
3. Configure DocuSign Connect webhook URL: `https://<ngrok-id>.ngrok.io/webhooks/docusign`
4. Send test envelopes and observe webhook delivery
5. Use ngrok web interface to inspect webhook payloads

**Environment Setup**:
```bash
# .env.development
DOCUSIGN_INTEGRATION_KEY=your-integration-key
DOCUSIGN_USER_ID=your-user-id
DOCUSIGN_ACCOUNT_ID=your-account-id
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=your-webhook-secret
```

### Test Coverage Goals

- **Line coverage**: > 80%
- **Branch coverage**: > 75%
- **Property tests**: All 20 properties implemented
- **Unit tests**: All error conditions and edge cases covered
- **Integration tests**: All API endpoints covered
