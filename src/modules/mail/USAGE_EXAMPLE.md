# Email API Usage Example

## Your Exact Use Case

Based on your JSON structure, here's how to use the new enhanced email API:

### Input JSON Structure (Your Example)
```json
{
  "to": "tenant@example.com",
  "cc": ["manager@company.com", "legal@company.com"],
  "subject": "LOI for Suite 100 at Property Name",
  "body": "<div>HTML email content...</div>",
  "attachments": ["attachment-id-1", "attachment-id-2"],
  "loiKey": "documents/lead-69a49bcc4a4f3730af4d3b58/loi-pdf-s3-key"
}
```

### API Endpoint
```
POST /email/send
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Complete Request Example
```bash
curl -X POST http://localhost:3000/email/send \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "tenant@example.com",
    "cc": ["manager@company.com", "legal@company.com"],
    "subject": "LOI for Suite 100 at Property Name",
    "body": "<div>HTML email content...</div>",
    "attachments": ["attachment-id-1", "attachment-id-2"],
    "loiKey": "documents/lead-69a49bcc4a4f3730af4d3b58/loi-pdf-s3-key"
  }'
```

### Service Usage in Your Code

```typescript
import { Injectable } from '@nestjs/common';
import { EmailOrchestratorService } from '../mail/services/email-orchestrator.service';

@Injectable()
export class YourService {
  constructor(
    private readonly emailService: EmailOrchestratorService
  ) {}

  async sendLOIEmail(emailData: {
    to: string;
    cc?: string[];
    subject: string;
    body: string;
    attachments?: string[];
    loiKey?: string;
  }) {
    try {
      const result = await this.emailService.sendEmail({
        to: emailData.to,
        cc: emailData.cc,
        subject: emailData.subject,
        body: emailData.body,
        attachments: emailData.attachments,
        loiKey: emailData.loiKey,
        priority: 'high', // Optional: set priority for LOI emails
        metadata: {
          emailType: 'loi',
          timestamp: new Date().toISOString()
        }
      });

      console.log('✅ Email sent successfully:', result.messageId);
      return result;

    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      throw error;
    }
  }
}
```

### Controller Implementation

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { YourService } from './your.service';

@Controller('loi')
export class LOIController {
  constructor(private readonly yourService: YourService) {}

  @Post('send-email')
  async sendLOIEmail(@Body() emailData: {
    to: string;
    cc?: string[];
    subject: string;
    body: string;
    attachments?: string[];
    loiKey?: string;
  }) {
    return await this.yourService.sendLOIEmail(emailData);
  }
}
```

### Response Structure

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
      "recipientCount": 3,
      "attachmentCount": 3
    }
  }
}
```

## Key Features for Your Use Case

### 1. Attachment Processing
- **Regular Attachments**: `["attachment-id-1", "attachment-id-2"]` - These are processed from S3 using the MediaService
- **LOI Document**: `"loiKey": "documents/lead-69a49bcc4a4f3730af4d3b58/loi-pdf-s3-key"` - Special handling for LOI documents

### 2. Recipient Management
- **Primary Recipient**: `"to": "tenant@example.com"`
- **CC Recipients**: `["manager@company.com", "legal@company.com"]`
- **BCC Support**: Optional BCC recipients for audit/compliance

### 3. Content Processing
- **HTML Body**: Automatically enhanced with email-friendly CSS
- **Subject Line**: Validated and processed
- **Priority**: Can be set to 'high' for important LOI emails

### 4. Error Handling
```typescript
try {
  const result = await this.emailService.sendEmail(emailData);
  // Success handling
} catch (error) {
  if (error.response?.details?.type === 'ATTACHMENT_ERROR') {
    // Handle attachment-specific errors
    console.error('Attachment processing failed:', error.response.details.description);
  } else if (error.response?.details?.type === 'RECIPIENT_ERROR') {
    // Handle recipient-specific errors
    console.error('Invalid recipient:', error.response.details.description);
  } else {
    // Handle general errors
    console.error('Email sending failed:', error.message);
  }
}
```

### 5. Validation
The API automatically validates:
- ✅ Email format for all recipients (to, cc, bcc)
- ✅ Subject line length and content
- ✅ HTML body safety and structure
- ✅ Attachment existence and accessibility
- ✅ S3 key validity for LOI documents

### 6. Logging and Tracking
Every email gets:
- 🔍 Unique request ID for tracking
- ⏱️ Performance metrics (processing time)
- 📊 Recipient and attachment counts
- 📝 Comprehensive audit logs

## Integration Steps

1. **Import the service** in your module:
```typescript
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  // ...
})
export class YourModule {}
```

2. **Inject the service** in your class:
```typescript
constructor(
  private readonly emailService: EmailOrchestratorService
) {}
```

3. **Use the service** with your exact JSON structure:
```typescript
await this.emailService.sendEmail(yourJsonData);
```

## Testing Your Implementation

Use the provided test file:
```bash
node test-email-api.js
```

Or test manually with curl:
```bash
curl -X POST http://localhost:3000/email/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @your-email-data.json
```

This implementation follows SOLID and DRY principles while providing a robust, scalable solution for your email sending needs.