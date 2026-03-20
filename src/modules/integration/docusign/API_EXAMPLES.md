# DocuSign Integration - API Usage Examples

This document provides practical examples for using the DocuSign integration API endpoints.

## Table of Contents

- [Authentication](#authentication)
- [Send Lease for Signature](#send-lease-for-signature)
- [Webhook Examples](#webhook-examples)
- [Error Handling](#error-handling)
- [Integration Patterns](#integration-patterns)

---

## Authentication

All API endpoints (except webhooks) require JWT authentication. Include the JWT token in the Authorization header.

### Getting a JWT Token

```bash
# Login to get JWT token
curl -X POST http://localhost:4010/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

**Response**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "property_manager"
  }
}
```

Use the `accessToken` in subsequent requests.

---

## Send Lease for Signature

### Basic Usage

Send a lease document to the tenant for signature using default settings.

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response** (200 OK):
```json
{
  "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "sent",
  "statusDateTime": "2024-01-15T10:30:00.000Z",
  "uri": "/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Override Recipient Email

Send to a different email address than the tenant's default email.

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "alternate@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "envelopeId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "status": "sent",
  "statusDateTime": "2024-01-15T10:35:00.000Z",
  "uri": "/envelopes/b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

### Custom Signature Position

Specify where the signature field should appear on the document.

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "signaturePosition": {
      "pageNumber": 3,
      "xPosition": 150,
      "yPosition": 250
    }
  }'
```

**Response** (200 OK):
```json
{
  "envelopeId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "status": "sent",
  "statusDateTime": "2024-01-15T10:40:00.000Z",
  "uri": "/envelopes/c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

### Full Example with All Options

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "tenant@example.com",
    "signaturePosition": {
      "pageNumber": 1,
      "xPosition": 100,
      "yPosition": 200
    }
  }'
```

---

## Webhook Examples

Webhooks are sent by DocuSign to your application. You don't call these endpoints directly, but you can test them locally.

### Envelope Sent Event

Triggered when an envelope is successfully sent to recipients.

**Webhook Payload**:
```json
{
  "event": "envelope-sent",
  "apiVersion": "v2.1",
  "uri": "/restapi/v2.1/accounts/87654321/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "retryCount": 0,
  "configurationId": 12345,
  "generatedDateTime": "2024-01-15T10:30:00.0000000Z",
  "data": {
    "accountId": "87654321",
    "userId": "12345678-abcd-1234-abcd-1234567890ab",
    "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "envelopeSummary": {
      "status": "sent",
      "emailSubject": "Please sign: Lease Agreement",
      "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "recipients": {
        "signers": [
          {
            "email": "tenant@example.com",
            "name": "John Tenant",
            "recipientId": "1",
            "status": "sent"
          }
        ]
      }
    }
  }
}
```

### Envelope Completed Event

Triggered when all recipients have completed signing.

**Webhook Payload**:
```json
{
  "event": "envelope-completed",
  "apiVersion": "v2.1",
  "uri": "/restapi/v2.1/accounts/87654321/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "retryCount": 0,
  "configurationId": 12345,
  "generatedDateTime": "2024-01-15T11:00:00.0000000Z",
  "data": {
    "accountId": "87654321",
    "userId": "12345678-abcd-1234-abcd-1234567890ab",
    "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "envelopeSummary": {
      "status": "completed",
      "emailSubject": "Please sign: Lease Agreement",
      "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "completedDateTime": "2024-01-15T11:00:00.0000000Z",
      "recipients": {
        "signers": [
          {
            "email": "tenant@example.com",
            "name": "John Tenant",
            "recipientId": "1",
            "status": "completed",
            "signedDateTime": "2024-01-15T11:00:00.0000000Z"
          }
        ]
      }
    }
  }
}
```

### Testing Webhooks Locally

Use cURL to simulate a webhook (without HMAC validation for testing):

```bash
# Temporarily disable HMAC validation in your code for testing
curl -X POST http://localhost:4010/webhooks/docusign \
  -H "Content-Type: application/json" \
  -H "X-DocuSign-Signature-1: test-signature" \
  -d '{
    "event": "envelope-completed",
    "data": {
      "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "envelopeSummary": {
        "status": "completed"
      }
    }
  }'
```

---

## Error Handling

### Lease Not Found (404)

**Request**:
```bash
curl -X POST http://localhost:4010/leases/invalid-lease-id/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response** (404 Not Found):
```json
{
  "statusCode": 404,
  "message": "Lease not found",
  "error": "Not Found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/invalid-lease-id/send-for-signature"
}
```

### Missing PDF Document

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response** (500 Internal Server Error):
```json
{
  "statusCode": 500,
  "message": "PDF document not found for lease",
  "error": "Internal Server Error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature",
  "details": {
    "leaseId": "507f1f77bcf86cd799439011"
  }
}
```

### Invalid Recipient Email

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "invalid-email"
  }'
```

**Response** (400 Bad Request):
```json
{
  "statusCode": 400,
  "message": ["recipientEmail must be an email"],
  "error": "Bad Request",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature"
}
```

### DocuSign API Error

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Response** (500 Internal Server Error):
```json
{
  "statusCode": 500,
  "message": "Failed to create DocuSign envelope",
  "error": "Internal Server Error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature",
  "details": {
    "docusignError": "ACCOUNT_LACKS_PERMISSIONS",
    "docusignMessage": "This account lacks sufficient permissions."
  }
}
```

### Unauthorized (401)

**Request**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Content-Type: application/json"
```

**Response** (401 Unauthorized):
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature"
}
```

---

## Integration Patterns

### Pattern 1: Send and Track

Send a lease for signature and track its status.

```javascript
// Frontend code example
async function sendLeaseForSignature(leaseId) {
  try {
    // Step 1: Send for signature
    const response = await fetch(
      `http://localhost:4010/leases/${leaseId}/send-for-signature`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send lease for signature');
    }

    const data = await response.json();
    console.log('Envelope sent:', data.envelopeId);

    // Step 2: Update UI to show "Pending Signature" status
    updateLeaseStatus(leaseId, 'PENDING_SIGNATURE');

    // Step 3: Poll for status updates (or use webhooks)
    pollLeaseStatus(leaseId);

    return data;
  } catch (error) {
    console.error('Error sending lease:', error);
    throw error;
  }
}

async function pollLeaseStatus(leaseId) {
  const interval = setInterval(async () => {
    const lease = await fetchLease(leaseId);
    
    if (lease.signatureStatus === 'SIGNED') {
      console.log('Lease signed!');
      clearInterval(interval);
      updateUI(lease);
    }
  }, 5000); // Poll every 5 seconds
}
```

### Pattern 2: Batch Processing

Send multiple leases for signature in batch.

```javascript
async function sendMultipleLeasesForSignature(leaseIds) {
  const results = await Promise.allSettled(
    leaseIds.map(leaseId =>
      fetch(`http://localhost:4010/leases/${leaseId}/send-for-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.json())
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  console.log(`Sent ${successful.length} leases successfully`);
  console.log(`Failed to send ${failed.length} leases`);

  return { successful, failed };
}
```

### Pattern 3: Webhook Processing

Handle webhook events in your application.

```javascript
// Backend webhook handler (already implemented in DocuSignController)
// This is how the system processes webhooks internally

@Post('webhooks/docusign')
@UseGuards(HmacValidationGuard)
async handleWebhook(@Body() payload: DocuSignWebhookDto) {
  // Extract envelope status
  const status = payload.data.envelopeSummary.status;
  
  if (status === 'completed') {
    const envelopeId = payload.data.envelopeId;
    
    // Find lease by envelope ID
    const lease = await this.leasingService.findByEnvelopeId(envelopeId);
    
    if (!lease) {
      this.logger.warn(`Lease not found for envelope ${envelopeId}`);
      return;
    }
    
    // Retrieve signed document
    const signedPdf = await this.docusignService.getSignedDocument(envelopeId);
    
    // Store signed document
    await this.storageService.storeSignedDocument(lease.id, signedPdf);
    
    // Update lease status
    await this.leasingService.updateLeaseStatus(lease.id, 'SIGNED');
    
    this.logger.info(`Lease ${lease.id} signed successfully`);
  }
}
```

### Pattern 4: Error Recovery

Handle errors gracefully and retry if needed.

```javascript
async function sendLeaseWithRetry(leaseId, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `http://localhost:4010/leases/${leaseId}/send-for-signature`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        return await response.json();
      }

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }

      lastError = new Error(`Server error: ${response.status}`);
      console.log(`Attempt ${attempt} failed, retrying...`);
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }
  
  throw lastError;
}
```

### Pattern 5: Custom Email Subject

Customize the email subject for the signature request.

```javascript
// Note: This requires extending the DTO and service
// Example of how it could be implemented

async function sendLeaseWithCustomSubject(leaseId, subject) {
  const response = await fetch(
    `http://localhost:4010/leases/${leaseId}/send-for-signature`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailSubject: subject
      })
    }
  );

  return await response.json();
}
```

---

## Postman Collection

Import this collection into Postman for easy testing:

```json
{
  "info": {
    "name": "DocuSign Integration API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Send Lease for Signature",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{jwt_token}}",
            "type": "text"
          },
          {
            "key": "Content-Type",
            "value": "application/json",
            "type": "text"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"recipientEmail\": \"tenant@example.com\"\n}"
        },
        "url": {
          "raw": "http://localhost:4010/leases/{{lease_id}}/send-for-signature",
          "protocol": "http",
          "host": ["localhost"],
          "port": "4010",
          "path": ["leases", "{{lease_id}}", "send-for-signature"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "jwt_token",
      "value": "your_jwt_token_here"
    },
    {
      "key": "lease_id",
      "value": "507f1f77bcf86cd799439011"
    }
  ]
}
```

---

## Additional Resources

- [DocuSign API Reference](https://developers.docusign.com/docs/esign-rest-api/reference)
- [DocuSign Webhooks Guide](https://developers.docusign.com/platform/webhooks/)
- [Full Documentation](./README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_CHECKLIST.md)
