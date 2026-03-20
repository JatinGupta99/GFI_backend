# Custom Email with DocuSign Signing URL

## Overview

The system now sends a **custom branded email** from your backend with the DocuSign signing URL embedded as a button. This gives you complete control over the email content, branding, and delivery.

## How It Works

1. **Envelope Creation**: DocuSign envelope is created with `status: 'sent'`
2. **Signing URL Generation**: A recipient view URL is generated via DocuSign API
3. **Custom Email**: Your backend sends a branded email with:
   - Custom subject and body
   - Big "Sign Lease via DocuSign" button
   - PDF attachment (if available)
   - CC support
   - Your company branding

## API Request

```bash
POST /api/leases/:id/send-for-signature
Content-Type: application/json

{
  "leaseId": "696f378fb71306063de85863",
  "recipientEmail": "tenant@example.com",  // Optional - uses lease email if not provided
  "cc": "manager@globalfund.com",          // Optional - CC recipients
  "isTesting": true                         // Optional - uses local test PDF
}
```

## Email Template

The email sent to the tenant looks like this:

```
From: Global Fund Investments
To: tenant@example.com
CC: manager@globalfund.com (if provided)
Subject: Lease Agreement - Property Name, Suite 123

Hi Jatin,

Here is the execution copy of the lease for Property Name, Suite 123.

Please review and sign the lease document using the button below:

┌─────────────────────────────────┐
│  📝 Sign Lease via DocuSign    │  ← BIG BUTTON
└─────────────────────────────────┘

If the button doesn't work, you can copy and paste this link into your browser:
https://demo.docusign.net/Signing/StartInSession.aspx?t=...

Attachment: Tenant Name - Lease Agreement.pdf

Thanks,
Global Fund Investments
```

## Benefits

✅ **Complete Control**: You control the email content, branding, and design
✅ **CC/BCC Support**: Add managers, admins, or other stakeholders
✅ **Custom Branding**: Use your company name and styling
✅ **PDF Attachment**: Lease document is attached for reference
✅ **Fallback Link**: Plain text URL provided if button doesn't work
✅ **Error Resilience**: Email sending errors don't fail envelope creation
✅ **Tracking**: All emails logged for audit trail

## Configuration

### Environment Variables

```env
# SMTP Configuration (already configured)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# DocuSign Return URL (where users go after signing)
DOCUSIGN_RETURN_URL=https://your-app.com/signing-complete
```

## Customization

### Email Template

To customize the email template, edit the HTML in:
`src/modules/integration/docusign/docusign.controller.ts` (line ~195)

You can modify:
- Email styling (colors, fonts, layout)
- Button design
- Company branding
- Additional content
- Footer information

### Subject Line

The subject line is automatically generated as:
```
Lease Agreement - {Property Name}, Suite {Suite Number}
```

To customize, modify line ~220 in the controller.

## Testing

1. Start your backend server
2. Make a POST request to `/api/leases/:id/send-for-signature`
3. Check the recipient's email inbox
4. Click the "Sign Lease via DocuSign" button
5. Complete the signing process

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify SMTP credentials in `.env`
3. Check backend logs for email sending errors
4. Verify recipient email is correct

### Signing URL Not Working

1. Check if `signingUrl` is in the API response
2. Verify DocuSign credentials are correct
3. Check DocuSign account settings
4. Ensure envelope was created successfully

### PDF Not Attached

1. Verify `pdfDocumentUrl` exists in the lease record
2. Check S3 bucket permissions
3. Check backend logs for PDF download errors

## API Response

```json
{
  "envelopeId": "57d72bea-4a22-810b-81ac-544fec23191f",
  "status": "sent",
  "statusDateTime": "2026-02-25T23:10:50Z",
  "uri": "/envelopes/57d72bea-4a22-810b-81ac-544fec23191f",
  "signingUrl": "https://demo.docusign.net/Signing/StartInSession.aspx?t=..."
}
```

## Next Steps

- Customize the email template to match your branding
- Add more CC recipients as needed
- Set up email tracking and analytics
- Create follow-up email workflows
- Add SMS notifications with the signing URL
