# Email Sending Issue Debug Guide

## Current Error
```
InternalServerErrorException: Failed to send email
at MailService.send (mail.service.ts:94:13)
at LeadsService.sendLoiEmail (leads.service.ts:523:5)
```

## Potential Causes & Solutions

### 1. SMTP Configuration Issues
**Check SMTP settings in environment variables:**
```bash
# Check if these are properly set
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER
echo $SMTP_PASS
echo $SMTP_SECURE
echo $MAIL_FROM
```

### 2. Attachment Format Issues
The error might be caused by mixed attachment formats. I've updated the code to use consistent buffer-based attachments.

**Before (Mixed formats):**
```typescript
// URL-based attachment
{ filename: 'file.pdf', path: 'https://s3.amazonaws.com/...' }
// Buffer-based attachment  
{ filename: 'file.pdf', content: Buffer, contentType: 'application/pdf' }
```

**After (Consistent format):**
```typescript
// All buffer-based attachments
{ filename: 'file.pdf', content: Buffer, contentType: 'application/pdf' }
```

### 3. Template Issues
The general template expects:
- `body` field for HTML content
- `subject` field for email subject
- `email` field for recipient

### 4. Debugging Steps

#### Step 1: Test without attachments
```bash
curl -X POST 'http://localhost:4020/api/leasing/active-leads/69a49bd04a4f3730af4d3b5a/send' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "to": "test@example.com",
    "subject": "Test Email",
    "body": "<p>Simple test email</p>",
    "attachments": []
  }'
```

#### Step 2: Test with follow-up only
```bash
curl -X POST 'http://localhost:4020/api/leasing/active-leads/69a49bd04a4f3730af4d3b5a/send' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "to": "test@example.com",
    "subject": "Test Email with Follow-up",
    "body": "<p>Test email with follow-up</p>",
    "attachments": [],
    "followUpDays": 3,
    "followUpAutomatedDay": false
  }'
```

#### Step 3: Check logs for detailed error
Look for these log entries:
```
[MailService] Email payload: {...}
[MailService] Error details: ...
[MailService] SMTP Error Code: ...
[MailService] Full error object: ...
[LeadsService] Sending email with payload: {...}
```

### 5. Common SMTP Errors & Solutions

#### Authentication Error
```
SMTP Error Code: EAUTH
```
**Solution:** Check SMTP_USER and SMTP_PASS credentials

#### Connection Error
```
SMTP Error Code: ECONNECTION
```
**Solution:** Check SMTP_HOST and SMTP_PORT

#### Size Limit Error
```
Error: Message size exceeds maximum allowed size
```
**Solution:** Reduce attachment sizes or split into multiple emails

#### Template Error
```
Error: Template 'general' not found
```
**Solution:** Ensure template files exist in src/modules/mail/templates/

### 6. Environment Variables Check
Create a test endpoint to verify configuration:

```typescript
@Get('debug/email-config')
async debugEmailConfig() {
  return {
    smtpHost: this.configService.get('SMTP_HOST'),
    smtpPort: this.configService.get('SMTP_PORT'),
    smtpSecure: this.configService.get('SMTP_SECURE'),
    smtpUser: this.configService.get('SMTP_USER'),
    mailFrom: this.configService.get('MAIL_FROM'),
    hasSmtpPass: !!this.configService.get('SMTP_PASS'),
  };
}
```

### 7. Test SMTP Connection
Add a simple SMTP test:

```typescript
@Get('debug/smtp-test')
async testSMTP() {
  try {
    await this.mailerService.sendMail({
      to: 'test@example.com',
      subject: 'SMTP Test',
      html: '<p>SMTP connection test</p>',
    });
    return { success: true, message: 'SMTP test successful' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Next Steps

1. **Run the curl command without attachments** to isolate the issue
2. **Check the application logs** for the detailed error information I added
3. **Verify SMTP configuration** in your environment
4. **Test with a simple email** first, then add complexity

The enhanced logging will show exactly what's failing in the email sending process.