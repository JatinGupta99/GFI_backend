# Property Management 3-Day Notice - cURL Fix

## 🐛 Issue

Your cURL request is sending extra fields (`leadData`, `attachments`) that aren't expected by the API endpoint.

## ✅ Correct Request Format

The endpoint expects only:
- `emailData` - Email information
- `note` - Optional note

### **Fixed cURL Command:**

```bash
curl -X POST 'http://localhost:4020/api/property-management/ar-balances/69a49b8f4a4f3730af4d3b52/notices/3-day' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTUzN2M2NzkwNjVhNzEzYWJlYzc3NGYiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJuYW1lIjoiSmF0aW4gR3VwdGEiLCJyb2xlIjoiTEVBU0lORyIsImF2YXRhciI6InVzZXJzLzY5NTM3YzY3OTA2NWE3MTNhYmVjNzc0Zi9wcm9maWxlLWltYWdlL2QyOGVkNWNmLTg3MzAtNGU4Zi05M2I1LTQwMzI5ZTMxNGMyYy5qcGVnLzg3OTA1YzdmLTQ4YzUtNGEwNy1iZGUwLTdmYmVmNTRiNzEyNC5qcGVnIiwicHJvcGVydGllcyI6W10sImlhdCI6MTc3MjM3MTkzNiwiZXhwIjoxNzcyNDU4MzM2fQ.P2tfbHuwdFFPd3vKydKETQV6Ut5uwbikWHVePpLYmTc' \
  -H 'Content-Type: application/json' \
  -d '{
    "emailData": {
      "email": "john.doe@example.com",
      "userName": "Jatin Gupta",
      "userTitle": "OWNER",
      "attorneyName": "Richard Cohen",
      "tenantInfo": {
        "tenant": "Doe Enterprises LLC",
        "property": "Richwood"
      },
      "tenantAddress": "123 Main St, Suite 200, Dallas, TX 75001",
      "tenantEmail": "john.doe@example.com",
      "tenantPhone": "+1-555-0123",
      "currentDate": "March 2, 2026",
      "outstandingBalance": 100,
      "lateFee": 0,
      "totalAmount": 100,
      "premisesAddress": "Richwood, Suite 200",
      "managerName": "Jatin Gupta",
      "managerTitle": "OWNER"
    },
    "note": ""
  }'
```

## 📋 Request Structure

### Required Fields

```typescript
{
  "emailData": {
    "email": string,              // Required - Recipient email
    "userName": string,            // Optional - Sender name
    "userTitle": string,           // Optional - Sender title
    "attorneyName": string,        // Optional - Attorney name (for attorney notices)
    "tenantInfo": {
      "tenant": string,            // Tenant name
      "property": string           // Property name
    },
    "tenantAddress": string,       // Optional
    "tenantEmail": string,         // Optional
    "tenantPhone": string,         // Optional
    "currentDate": string,         // Optional - defaults to today
    "outstandingBalance": number,  // Optional
    "lateFee": number,             // Optional
    "totalAmount": number,         // Optional
    "premisesAddress": string,     // Optional
    "managerName": string,         // Optional
    "managerTitle": string         // Optional
  },
  "note": string                   // Optional - Internal note
}
```

## 🎯 Available Notice Types

### 1. Courtesy Notice
```bash
POST /property-management/ar-balances/:tenantId/notices/courtesy
```

### 2. 3-Day Notice
```bash
POST /property-management/ar-balances/:tenantId/notices/3-day
```

### 3. Attorney Notice
```bash
POST /property-management/ar-balances/:tenantId/notices/attorney
```

## 📊 What Happens When You Send a Notice

1. **Email Sent** - Notice email sent to tenant
2. **Status Updated** - AR notice status updated in database
3. **Lead Status Updated** - Lead status changed to:
   - Courtesy → `SEND_COURTESY_NOTICE`
   - 3-Day → `SEND_THREE_DAY_NOTICE`
   - Attorney → `SEND_TO_ATTORNEY`

## 🧪 Complete Examples

### Courtesy Notice
```bash
curl -X POST 'http://localhost:4020/api/property-management/ar-balances/TENANT_ID/notices/courtesy' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "emailData": {
      "email": "tenant@example.com",
      "userName": "Property Manager",
      "userTitle": "Property Manager",
      "tenantInfo": {
        "tenant": "ABC Company",
        "property": "Main Street Plaza"
      },
      "outstandingBalance": 5000,
      "lateFee": 250,
      "totalAmount": 5250
    },
    "note": "First courtesy notice sent"
  }'
```

### 3-Day Notice
```bash
curl -X POST 'http://localhost:4020/api/property-management/ar-balances/TENANT_ID/notices/3-day' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "emailData": {
      "email": "tenant@example.com",
      "userName": "Property Manager",
      "userTitle": "Property Manager",
      "tenantInfo": {
        "tenant": "ABC Company",
        "property": "Main Street Plaza"
      },
      "tenantAddress": "123 Main St, Suite 100",
      "outstandingBalance": 5000,
      "lateFee": 250,
      "totalAmount": 5250,
      "currentDate": "March 2, 2026",
      "premisesAddress": "Main Street Plaza, Suite 100"
    },
    "note": "3-day notice sent after no response to courtesy notice"
  }'
```

### Attorney Notice
```bash
curl -X POST 'http://localhost:4020/api/property-management/ar-balances/TENANT_ID/notices/attorney' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "emailData": {
      "email": "tenant@example.com",
      "userName": "Property Manager",
      "userTitle": "Property Manager",
      "attorneyName": "John Smith, Esq.",
      "tenantInfo": {
        "tenant": "ABC Company",
        "property": "Main Street Plaza"
      },
      "tenantAddress": "123 Main St, Suite 100",
      "outstandingBalance": 5000,
      "lateFee": 250,
      "totalAmount": 5250
    },
    "note": "Case referred to attorney"
  }'
```

## 🔍 Response Format

### Success Response
```json
{
  "success": true,
  "status": "SEND_THREE_DAY_NOTICE"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## ⚠️ Common Issues

### Issue 1: Extra Fields in Request
**Problem:** Sending `leadData`, `attachments`, or other extra fields  
**Solution:** Only send `emailData` and `note`

### Issue 2: Missing Required Email
**Problem:** `emailData.email` is missing or invalid  
**Solution:** Ensure `emailData.email` is a valid email address

### Issue 3: Wrong Notice Type
**Problem:** Using invalid notice type in URL  
**Solution:** Use only: `courtesy`, `3-day`, or `attorney`

### Issue 4: Invalid Tenant ID
**Problem:** Tenant ID doesn't exist  
**Solution:** Verify the tenant ID exists in the database

## 💡 Frontend Integration

```typescript
// TypeScript/React example
const send3DayNotice = async (tenantId: string, emailData: any, note: string = '') => {
  const response = await fetch(
    `http://localhost:4020/api/property-management/ar-balances/${tenantId}/notices/3-day`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailData: {
          email: emailData.email,
          userName: emailData.userName,
          userTitle: emailData.userTitle,
          tenantInfo: {
            tenant: emailData.tenantInfo.tenant,
            property: emailData.tenantInfo.property
          },
          outstandingBalance: emailData.outstandingBalance,
          lateFee: emailData.lateFee,
          totalAmount: emailData.totalAmount,
          currentDate: new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })
        },
        note
      })
    }
  );

  return response.json();
};
```

## ✅ Checklist

- [ ] Remove `leadData` from request body
- [ ] Remove `attachments` from request body
- [ ] Ensure `emailData.email` is present and valid
- [ ] Use correct notice type: `courtesy`, `3-day`, or `attorney`
- [ ] Include tenant ID in URL
- [ ] Add Authorization header with valid token
- [ ] Set Content-Type to `application/json`

---

**Status:** ✅ Ready to Use  
**Endpoint:** `POST /property-management/ar-balances/:tenantId/notices/:type`  
**Notice Types:** `courtesy`, `3-day`, `attorney`
