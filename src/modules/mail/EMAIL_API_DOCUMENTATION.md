# Enhanced Email API Documentation

## Overview

This enhanced email API follows SOLID and DRY principles to provide a robust, scalable email sending solution with support for attachments, LOI documents, and advanced features.

## Architecture

### SOLID Principles Implementation

1. **Single Responsibility Principle (SRP)**
   - `EmailValidatorService`: Only handles email validation
   - `EmailAttachmentService`: Only processes attachments
   - `EmailProcessorService`: Only processes email requests
   - `EnhancedMailService`: Only sends emails
   - `EmailOrchestratorService`: Only orchestrates the workflow

2. **Open/Closed Principle (OCP)**
   - Services are open for extension but closed for modification
   - New email types can be added without changing existing code

3. **Liskov Substitution Principle (LSP)**
   - All services implement clear interfaces
   - Services can be substituted without breaking functionality

4. **Interface Segregation Principle (ISP)**
   - Each service has focused, specific interfaces
   - No service depends on methods it doesn't use

5. **Dependency Inversion Principle (DIP)**
   - High-level modules don't depend on low-level modules
   - Both depend on abstractions (interfaces)

### DRY Principle Implementation

- Common validation logic centralized in `EmailValidatorService`
- Attachment processing logic reused across different email types
- Error handling patterns standardized across all services
- Configuration and constants defined once and reused

## API Endpoints

### POST /email/send

Send a single email with full feature support.

#### Request Body

```json
{
  "to": "tenant@example.com",
  "cc": ["manager@company.com", "legal@company.com"],
  "bcc": ["audit@company.com"],
  "subject": "LOI for Suite 100 at Property Name",
  "body": "<div><h2>Letter of Intent</h2><p>Please find attached the Letter of Intent.</p></div>",
  "attachments": ["attachment-id-1", "attachment-id-2"],
  "loiKey": "documents/lead-69a49bcc4a4f3730af4d3b58/loi-pdf-s3-key",
  "priority": "high",
  "metadata": {
    "leadId": "69a49bcc4a4f3730af4d3b58",
    "propertyId": "prop-123",
    "templateId": "loi-template"
  }
}
```

#### Response

```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "messageId": "<20240101120000.1234@smtp.example.com>",
    "sentAt": "2024-01-01T12:00:00.000Z",
    "metadata": {
      "requestId": "email_1704110400000_abc123",
      "duration": 1250,
      "recipientCount": 4,
      "attachmentCount": 3
    }
  }
}
```

### POST /email/send-batch

Send multiple emails in batch with concurrency control.

#### Request Body

```json
{
  "emails": [
    {
      "to": "tenant1@example.com",
      "subject": "LOI for Suite 100",
      "body": "<div>Email content 1</div>",
      "attachments": ["attachment-1"]
    },
    {
      "to": "tenant2@example.com",
      "subject": "LOI for Suite 200",
      "body": "<div>Email content 2</div>",
      "loiKey": "documents/lead-123/loi.pdf"
    }
  ],
  "options": {
    "concurrency": 3,
    "delayBetweenEmails": 100,
    "continueOnError": true
  }
}
```

#### Response

```json
{
  "success": true,
  "message": "Batch email processing completed",
  "data": {
    "successful": 8,
    "failed": 2,
    "results": [
      {
        "success": true,
        "email": "tenant1@example.com",
        "messageId": "<msg1@smtp.example.com>"
      },
      {
        "success": false,
        "email": "invalid@email",
        "error": "Invalid email format"
      }
    ]
  }
}
```

## Features

### 1. Comprehensive Validation

- Email format validation for all recipients
- Subject and body length limits
- Attachment count and size validation
- HTML content safety checks
- Duplicate recipient detection

### 2. Advanced Attachment Handling

- S3 integration for file retrieval
- Multiple attachment formats support
- Automatic MIME type detection
- Content-ID generation for inline attachments
- Error handling for missing/corrupted files

### 3. Email Processing

- HTML structure validation and enhancement
- Automatic CSS injection for better rendering
- Email-friendly styling
- Content sanitization

### 4. Priority Support

- Low, normal, high priority levels
- Proper email headers for client support
- Priority-based processing

### 5. Comprehensive Logging

- Request tracking with unique IDs
- Performance metrics
- Error analysis and categorization
- Audit trail for compliance

### 6. Error Handling

- Detailed error categorization
- Actionable error messages
- Retry suggestions
- Graceful degradation

## Usage Examples

### Basic Email

```typescript
import { EmailOrchestratorService } from './services/email-orchestrator.service';

// Inject the service
constructor(private emailService: EmailOrchestratorService) {}

// Send basic email
async sendWelcomeEmail(userEmail: string) {
  const result = await this.emailService.sendEmail({
    to: userEmail,
    subject: 'Welcome to Our Platform',
    body: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
    priority: 'normal'
  });
  
  console.log('Email sent:', result.messageId);
}
```

### LOI Email with Attachments

```typescript
async sendLOIEmail(leadData: any) {
  const result = await this.emailService.sendEmail({
    to: leadData.tenantEmail,
    cc: ['manager@company.com', 'legal@company.com'],
    subject: `LOI for ${leadData.propertyName}`,
    body: `
      <div>
        <h2>Letter of Intent</h2>
        <p>Dear ${leadData.tenantName},</p>
        <p>Please find attached the Letter of Intent for ${leadData.propertyName}.</p>
        <p>Best regards,<br>Property Management Team</p>
      </div>
    `,
    attachments: leadData.attachmentIds,
    loiKey: leadData.loiS3Key,
    priority: 'high',
    metadata: {
      leadId: leadData.id,
      propertyId: leadData.propertyId,
      templateId: 'loi-template'
    }
  });
  
  return result;
}
```

### Batch Email Processing

```typescript
async sendBulkNotifications(notifications: EmailRequest[]) {
  const result = await this.emailService.sendEmailBatch(notifications, {
    concurrency: 5,
    delayBetweenEmails: 200,
    continueOnError: true
  });
  
  console.log(`Sent ${result.successful}/${notifications.length} emails`);
  return result;
}
```

## Configuration

### Environment Variables

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM="Your Company <noreply@yourcompany.com>"

# AWS S3 Configuration (for attachments)
AWS_REGION=us-east-1
AWS_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Error Codes

| Code | Description | Suggestion |
|------|-------------|------------|
| `AUTHENTICATION_ERROR` | SMTP authentication failed | Check SMTP credentials |
| `CONNECTION_ERROR` | Failed to connect to SMTP server | Check server address and port |
| `RECIPIENT_ERROR` | Invalid or unreachable recipient | Verify email addresses |
| `SIZE_ERROR` | Email or attachment too large | Reduce attachment sizes |
| `RATE_LIMIT_ERROR` | Sending rate limit exceeded | Implement email queuing |
| `VALIDATION_ERROR` | Invalid email data | Check request format |

## Performance Considerations

1. **Attachment Processing**: Large attachments are processed asynchronously
2. **Batch Processing**: Configurable concurrency to prevent rate limiting
3. **Memory Management**: Streaming for large files to prevent memory issues
4. **Caching**: Attachment metadata cached to improve performance
5. **Connection Pooling**: SMTP connections reused for better performance

## Security Features

1. **Input Validation**: All inputs validated and sanitized
2. **HTML Sanitization**: Unsafe HTML content blocked
3. **Attachment Validation**: File types and sizes validated
4. **Rate Limiting**: Built-in protection against abuse
5. **Audit Logging**: Complete audit trail for compliance

## Testing

### suite Tests

```bash
npm run test -- --testPathPattern=mail
```

### Integration Tests

```bash
npm run test:e2e -- --testPathPattern=email
```

### Manual Testing

Use the provided test files:
- `test-email-api.js` - Basic email sending tests
- `test-batch-email.js` - Batch processing tests
- `test-attachments.js` - Attachment handling tests

## Migration from Legacy API

The new API is backward compatible. Existing code using `MailService` will continue to work, but new implementations should use `EmailOrchestratorService` for enhanced features.

### Legacy Usage
```typescript
await this.mailService.send(EmailType.GENERAL, {
  email: 'user@example.com',
  subject: 'Test',
  // ... other options
});
```

### New Usage
```typescript
await this.emailOrchestratorService.sendEmail({
  to: 'user@example.com',
  subject: 'Test',
  body: '<div>Content</div>',
  // ... enhanced options
});
```

## Support

For issues or questions:
1. Check the error logs for detailed error information
2. Verify SMTP and S3 configurations
3. Test with simple emails first before adding attachments
4. Use the provided test utilities for debugging