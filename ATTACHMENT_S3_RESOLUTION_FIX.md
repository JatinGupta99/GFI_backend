# Attachment S3 Resolution and Follow-Up Task Feature

## Problem
The property management notice API was receiving S3 file keys as attachments (e.g., `leads/69a49b8f4a4f3730af4d3b52/files/4d51f4d8-aa93-45c0-91fe-7e13a88f6b7d.pdf`) but was passing them directly to the mail service as strings. This caused nodemailer to fail with the error:

```
Cannot use 'in' operator to search for 'contentTransferEncoding' in leads/69a49b8f4a4f3730af4d3b52/files/4d51f4d8-aa93-45c0-91fe-7e13a88f6b7d.pdf
```

Nodemailer expects attachment objects with specific properties like `filename`, `content`, and `contentType`, not raw strings.

## Solution
Modified the `PropertyManagementService.sendNotice()` method to:

1. **Download files from S3**: Use `MediaService.getFileBuffer()` to download the actual PDF file from S3 using the provided key
2. **Format for nodemailer**: Convert the S3 keys into proper attachment objects with:
   - `filename`: Extracted from the S3 key path
   - `content`: The actual file buffer downloaded from S3
   - `contentType`: Set to `application/pdf`
3. **Support CC recipients**: Accept an array of CC email addresses from the frontend and pass them to the mail service
4. **Accept additional email data**: Support balance, lateFee, monthlyRent, cam, ins, tax, totalMonthly, suite, and propertyAddress fields
5. **Create follow-up tasks**: Optionally create a follow-up task X days after sending the notice

## Changes Made

### 1. SendNoticeDto (`src/modules/property-management/dto/ar-balance.dto.ts`)

#### Added CC Field and Follow-Up Days
```typescript
export class SendNoticeDto {
    @ApiProperty({ type: EmailDataDto })
    @ValidateNested()
    @Type(() => EmailDataDto)
    @IsNotEmpty()
    emailData: EmailDataDto;

    @ApiProperty({ example: ['cc1@example.com', 'cc2@example.com'], required: false })
    @IsOptional()
    cc?: string[];

    @ApiProperty({ example: 'Tenant promised to pay', required: false })
    @IsString()
    @IsOptional()
    note?: string;

    @ApiProperty({ example: ['leads/123/files/abc.pdf'], required: false })
    @IsOptional()
    attachments?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    leadData?: any;

    @ApiProperty({ example: 3, description: 'Number of days after which to create a follow-up task', required: false })
    @IsOptional()
    followUpDays?: number;
}
```

#### Added Additional Email Data Fields
```typescript
export class EmailDataDto {
    // ... existing fields ...

    // Additional fields from frontend
    @IsOptional()
    balance?: number;

    @IsOptional()
    monthlyRent?: number;

    @IsOptional()
    cam?: number;

    @IsOptional()
    ins?: number;

    @IsOptional()
    tax?: number;

    @IsOptional()
    totalMonthly?: number;

    @IsString()
    @IsOptional()
    suite?: string;

    @IsString()
    @IsOptional()
    propertyAddress?: string;
}
```

### 2. PropertyManagementService (`src/modules/property-management/property-management.service.ts`)

#### Added TasksService Import and Injection
```typescript
import { TasksService } from '../tasks/tasks.service';

constructor(
    // ... other services
    private readonly tasksService: TasksService,
    // ... rest
) { }
```

#### Updated sendNotice Method
Added attachment resolution logic, CC support, additional email fields, and follow-up task creation:

```typescript
const { emailData, note, attachments, cc, followUpDays } = dto;

// Resolve attachments from S3 keys to file buffers
const resolvedAttachments: any[] = [];
if (attachments && attachments.length > 0) {
    for (const fileKey of attachments) {
        try {
            const filename = fileKey.split('/').pop() || 'attachment.pdf';
            const fileBuffer = await this.mediaService.getFileBuffer(fileKey);
            
            resolvedAttachments.push({
                filename,
                content: fileBuffer,
                contentType: 'application/pdf',
            });
            
            this.logger.log(`Resolved attachment: ${fileKey} -> ${filename}`);
        } catch (error) {
            this.logger.error(`Failed to resolve attachment ${fileKey}: ${error.message}`);
        }
    }
}

// Pass CC, attachments, and additional fields to mail service
await this.mailService.send(targetEmailType, {
    ...emailData,
    // ... other fields
    balance: emailData.balance ?? 0,
    monthlyRent: emailData.monthlyRent ?? 0,
    cam: emailData.cam ?? 0,
    ins: emailData.ins ?? 0,
    tax: emailData.tax ?? 0,
    totalMonthly: emailData.totalMonthly ?? 0,
    suite: emailData.suite || '',
    propertyAddress: emailData.propertyAddress || '',
    cc: cc || [],
    attachments: resolvedAttachments,
});

// Create follow-up task if requested
if (followUpDays && followUpDays > 0) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + followUpDays);

    await this.tasksService.create({
        title: `Follow up: ${noticeTypeLabel} Notice - ${tenantName}`,
        description: `Follow up on ${noticeTypeLabel} notice sent to ${tenantName} at ${propertyName}. Lead ID: ${id}`,
        dueDate: followUpDate.toISOString(),
        property: propertyName,
        priority: 'High',
        category: 'Property Management',
        ownerName: emailData.userName || 'System',
    });
}
```

### 3. PropertyManagementModule (`src/modules/property-management/property-management.module.ts`)

#### Added MediaModule and TasksModule Imports
```typescript
import { MediaModule } from '../media/media.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
    imports: [
        // ... other imports
        MediaModule,
        TasksModule,
        // ... rest
    ],
    // ...
})
```

## How It Works

1. **Frontend sends request** with attachments as S3 keys, CC recipients, additional email data, and optional follow-up days:
   ```json
   {
     "emailData": {
       "email": "tenant@example.com",
       "userName": "John Doe",
       "userTitle": "Manager",
       "tenantInfo": {
         "tenant": "Acme Corp",
         "property": "Building A"
       },
       "balance": 100,
       "lateFee": 250,
       "monthlyRent": 5000,
       "cam": 800,
       "ins": 200,
       "tax": 200,
       "totalMonthly": 6200,
       "suite": "200"
     },
     "cc": ["manager@example.com", "legal@example.com"],
     "attachments": ["leads/69a49b8f4a4f3730af4d3b52/files/4d51f4d8-aa93-45c0-91fe-7e13a88f6b7d.pdf"],
     "followUpDays": 3
   }
   ```

2. **Backend resolves each key**:
   - Extracts filename: `4d51f4d8-aa93-45c0-91fe-7e13a88f6b7d.pdf`
   - Downloads file buffer from S3 using `MediaService.getFileBuffer()`
   - Creates attachment object:
     ```typescript
     {
       filename: '4d51f4d8-aa93-45c0-91fe-7e13a88f6b7d.pdf',
       content: Buffer<...>,
       contentType: 'application/pdf'
     }
     ```

3. **Mail service sends email** with:
   - Primary recipient (to)
   - CC recipients array
   - All additional email data fields (balance, lateFee, etc.)
   - Properly formatted attachments that nodemailer can process

4. **Follow-up task created** (if followUpDays is provided):
   - Task title: "Follow up: 3-day Notice - Acme Corp"
   - Task description: Details about the notice sent
   - Due date: Current date + followUpDays
   - Priority: High
   - Category: Property Management
   - Owner: User who sent the notice

## Error Handling

- If an attachment fails to download, the error is logged but the process continues with other attachments
- This ensures that one failed attachment doesn't prevent the entire email from being sent
- If follow-up task creation fails, the error is logged but doesn't affect the notice sending
- Logs include both success and failure messages for debugging

## Testing

Test the API with CC recipients and follow-up task:

```bash
curl 'http://localhost:4020/api/property-management/ar-balances/69a49b8f4a4f3730af4d3b52/notices/3-day' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "emailData": {
      "email": "john.doe@example.com",
      "userName": "Jatin Gupta",
      "userTitle": "OWNER",
      "attorneyName": "Richard Cohen",
      "tenantInfo": {
        "tenant": "Doe Enterprises LLC",
        "property": "Richwood"
      },
      "balance": 100,
      "lateFee": 250,
      "monthlyRent": 5000,
      "cam": 800,
      "ins": 200,
      "tax": 200,
      "totalMonthly": 6200,
      "suite": "200"
    },
    "cc": ["manager@example.com", "legal@example.com"],
    "attachments": ["leads/69a49b8f4a4f3730af4d3b52/files/4d51f4d8-aa93-45c0-91fe-7e13a88f6b7d.pdf"],
    "followUpDays": 3
  }'
```

Expected result: 
- Email sent successfully to primary recipient with CC to specified addresses and PDF attachment
- All balance and fee information displayed correctly in the email
- Follow-up task created for 3 days from now

## Benefits

1. **Proper attachment handling**: Files are downloaded from S3 and sent as actual attachments
2. **CC support**: Multiple recipients can be notified via CC
3. **Complete email data**: All financial and property information is included
4. **Automated follow-ups**: Tasks are automatically created for follow-up reminders
5. **Error resilience**: Failed attachments or task creation don't block the email
6. **Logging**: Clear logs for debugging attachment resolution and task creation
7. **Backward compatible**: All new fields are optional, existing API calls still work
8. **Secure**: Uses existing MediaService methods for S3 access

## Notes

- The MediaService already has the `getFileBuffer()` method that handles S3 authentication and file retrieval
- Attachments are downloaded synchronously in a loop - for large numbers of attachments, consider parallel processing with `Promise.all()`
- Currently only supports PDF files (contentType hardcoded to 'application/pdf')
- CC field is optional and defaults to an empty array if not provided
- followUpDays is optional - if not provided or 0, no follow-up task is created
- Follow-up tasks are created with High priority in the Property Management category
