# Property Management Notice API - Updated

## ✅ Changes Made

Updated the `SendNoticeDto` to accept additional fields from your frontend:
- `attachments` - Array of file paths/keys
- `leadData` - Complete lead data object

## 📋 Updated Request Format

Your original cURL request now works as-is! The API accepts:

```typescript
{
  "emailData": {
    "email": string,
    "userName": string,
    "userTitle": string,
    "attorneyName": string,
    "tenantInfo": {
      "tenant": string,
      "property": string
    }
    // ... other email fields
  },
  "note": string,
  "attachments": string[],  // ✅ NEW - Now accepted
  "leadData": any           // ✅ NEW - Now accepted
}
```

## 🚀 Your Original cURL Now Works!

```bash
curl 'http://localhost:4020/api/property-management/ar-balances/69a49b8f4a4f3730af4d3b52/notices/3-day' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
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
      }
    },
    "note": "",
    "attachments": ["leads/69a49b8f4a4f3730af4d3b52/files/4d51f4d8-aa93-45c0-91fe-7e13a88f6b7d.pdf"],
    "leadData": { ... }
  }'
```

## 📧 Attachments Support

The `attachments` array is now passed to the mail service. The mail service will handle:
- Resolving file paths to actual files
- Attaching them to the email
- Sending the complete notice with attachments

## 🔧 What Happens

1. **Email Sent** - Notice email with attachments sent to tenant
2. **Status Updated** - AR notice status updated
3. **Lead Status Changed** - Lead status updated to appropriate notice status
4. **Attachments Included** - Files from `attachments` array attached to email

## ✨ Backward Compatible

The API still works with the minimal format (without `attachments` and `leadData`):

```json
{
  "emailData": {
    "email": "tenant@example.com",
    "tenantInfo": {
      "tenant": "ABC Company",
      "property": "Main Plaza"
    }
  },
  "note": "Optional note"
}
```

## 📊 Response

```json
{
  "success": true,
  "status": "SEND_THREE_DAY_NOTICE"
}
```

## ✅ Status

**Updated:** ✅ Complete  
**Backward Compatible:** ✅ Yes  
**Attachments Support:** ✅ Yes  
**Your Request:** ✅ Now Works!

---

**Files Modified:**
- `src/modules/property-management/dto/ar-balance.dto.ts` - Added `attachments` and `leadData` fields
- `src/modules/property-management/property-management.service.ts` - Updated to pass attachments to mail service
