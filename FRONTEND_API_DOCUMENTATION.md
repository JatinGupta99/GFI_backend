# DocuSign Integration - Frontend API Documentation

## Overview

This document provides complete API documentation for frontend developers integrating with the DocuSign lease signature functionality. The API allows you to send lease documents for electronic signature and track their status.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Base URL](#base-url)
3. [API Endpoints](#api-endpoints)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Integration Examples](#integration-examples)
7. [Status Flow](#status-flow)

---

## Authentication

All API endpoints require JWT authentication. Include the JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

To obtain a JWT token, authenticate through the login endpoint (see your auth documentation).

---

## Base URL

```
Development: http://localhost:4010
Production: <your_production_url>
```

---

## API Endpoints

### 1. Send Lease for Signature

Send a lease document to a tenant for electronic signature via DocuSign.

**Endpoint:** `POST /leases/:id/send-for-signature`

**Authentication:** Required

**URL Parameters:**
- `id` (string, required) - The lease ID

**Request Body:**

```typescript
{
  leaseId: string;              // Required - Must match the URL parameter
  recipientEmail?: string;      // Optional - Override tenant's default email
  signaturePosition?: {         // Optional - Custom signature field position
    pageNumber: number;         // Page number (1-indexed)
    xPosition: number;          // X coordinate in pixels
    yPosition: number;          // Y coordinate in pixels
  }
}
```

**Success Response (200 OK):**

```typescript
{
  envelopeId: string;           // DocuSign envelope ID
  status: string;               // Envelope status (typically "sent")
  statusDateTime: string;       // ISO 8601 timestamp
  uri: string;                  // DocuSign API URI for the envelope
}
```

**Example Request:**

```javascript
// Basic request - use tenant's default email
fetch('http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leaseId: '507f1f77bcf86cd799439011'
  })
});

// With custom recipient email
fetch('http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leaseId: '507f1f77bcf86cd799439011',
    recipientEmail: 'alternate@example.com'
  })
});

// With custom signature position
fetch('http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leaseId: '507f1f77bcf86cd799439011',
    signaturePosition: {
      pageNumber: 3,
      xPosition: 150,
      yPosition: 250
    }
  })
});
```

**Example Response:**

```json
{
  "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "sent",
  "statusDateTime": "2024-01-15T10:30:00.000Z",
  "uri": "/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## Data Models

### Lease Object

When fetching lease data, you'll receive these DocuSign-related fields:

```typescript
interface Lease {
  _id: string;
  
  // DocuSign Integration Fields
  docusignEnvelopeId?: string;        // DocuSign envelope ID (set after sending)
  signatureStatus: SignatureStatus;   // Current signature status
  signedDocumentUrl?: string;         // URL to signed PDF (set after completion)
  sentForSignatureAt?: Date;          // When sent for signature
  signedAt?: Date;                    // When signing was completed
  
  // Tenant Information
  tenantEmail: string;                // Tenant's email address
  tenantName: string;                 // Tenant's full name
  
  // Document
  pdfDocumentUrl?: string;            // URL to unsigned PDF
  
  // Other lease fields...
  propertyId?: string;
  suiteId?: string;
}
```

### Signature Status Enum

```typescript
enum SignatureStatus {
  DRAFT = 'DRAFT',                    // Lease created, not sent
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',  // Sent to tenant, awaiting signature
  SIGNED = 'SIGNED',                  // Tenant has signed
  VOIDED = 'VOIDED'                   // Signature request cancelled
}
```

### Send for Signature Request

```typescript
interface SendForSignatureDto {
  leaseId: string;                    // Required
  recipientEmail?: string;            // Optional
  signaturePosition?: {               // Optional
    pageNumber: number;
    xPosition: number;
    yPosition: number;
  };
}
```

### Envelope Response

```typescript
interface EnvelopeResponseDto {
  envelopeId: string;                 // DocuSign envelope ID
  status: string;                     // Envelope status
  statusDateTime: string;             // ISO 8601 timestamp
  uri: string;                        // DocuSign API URI
}
```

---

## Error Handling

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  details?: any;                      // Additional error context
}
```

### Common Error Scenarios

#### 1. Unauthorized (401)

**Cause:** Missing or invalid JWT token

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature"
}
```

**Solution:** Ensure you're including a valid JWT token in the Authorization header.

#### 2. Bad Request (400)

**Cause:** Invalid request data (e.g., invalid email format, missing required fields)

```json
{
  "statusCode": 400,
  "message": ["recipientEmail must be an email"],
  "error": "Bad Request",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature"
}
```

**Solution:** Validate input data before sending. Check that:
- `leaseId` is provided and not empty
- `recipientEmail` (if provided) is a valid email format
- `signaturePosition` values are positive numbers

#### 3. Not Found (404)

**Cause:** Lease ID doesn't exist or PDF document not found

```json
{
  "statusCode": 404,
  "message": "Lease with ID 507f1f77bcf86cd799439011 not found",
  "error": "Not Found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature"
}
```

**Solution:** Verify the lease ID exists before attempting to send for signature.

#### 4. Internal Server Error (500)

**Cause:** Server-side error (DocuSign API failure, PDF retrieval failure, etc.)

```json
{
  "statusCode": 500,
  "message": "Failed to send lease for signature: DocuSign API error",
  "error": "Internal Server Error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/leases/507f1f77bcf86cd799439011/send-for-signature"
}
```

**Solution:** Display a user-friendly error message and allow retry. Log the error for investigation.

---

## Integration Examples

### React/TypeScript Example

```typescript
import { useState } from 'react';

interface SendForSignatureRequest {
  leaseId: string;
  recipientEmail?: string;
  signaturePosition?: {
    pageNumber: number;
    xPosition: number;
    yPosition: number;
  };
}

interface EnvelopeResponse {
  envelopeId: string;
  status: string;
  statusDateTime: string;
  uri: string;
}

const useDocuSign = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendForSignature = async (
    leaseId: string,
    options?: Omit<SendForSignatureRequest, 'leaseId'>
  ): Promise<EnvelopeResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/leases/${leaseId}/send-for-signature`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            leaseId,
            ...options
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send for signature');
      }

      const data: EnvelopeResponse = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { sendForSignature, loading, error };
};

// Usage in component
const LeaseDetailPage = ({ leaseId }: { leaseId: string }) => {
  const { sendForSignature, loading, error } = useDocuSign();

  const handleSendForSignature = async () => {
    const result = await sendForSignature(leaseId);
    
    if (result) {
      console.log('Sent successfully:', result.envelopeId);
      // Update UI to show "Pending Signature" status
      // Optionally poll for status updates
    } else {
      console.error('Failed to send:', error);
      // Show error message to user
    }
  };

  return (
    <button 
      onClick={handleSendForSignature}
      disabled={loading}
    >
      {loading ? 'Sending...' : 'Send for Signature'}
    </button>
  );
};
```

### Vue.js Example

```vue
<template>
  <div>
    <button 
      @click="sendForSignature" 
      :disabled="loading"
    >
      {{ loading ? 'Sending...' : 'Send for Signature' }}
    </button>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  leaseId: string;
}

const props = defineProps<Props>();

const loading = ref(false);
const error = ref<string | null>(null);

const sendForSignature = async () => {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/leases/${props.leaseId}/send-for-signature`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leaseId: props.leaseId
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send for signature');
    }

    const data = await response.json();
    console.log('Sent successfully:', data.envelopeId);
    
    // Emit event or update store
    emit('signature-sent', data);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
};

const emit = defineEmits<{
  'signature-sent': [data: any]
}>();
</script>
```

### Angular Example

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';

interface SendForSignatureRequest {
  leaseId: string;
  recipientEmail?: string;
  signaturePosition?: {
    pageNumber: number;
    xPosition: number;
    yPosition: number;
  };
}

interface EnvelopeResponse {
  envelopeId: string;
  status: string;
  statusDateTime: string;
  uri: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocuSignService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  sendForSignature(
    leaseId: string,
    options?: Omit<SendForSignatureRequest, 'leaseId'>
  ): Observable<EnvelopeResponse> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getAuthToken()}`,
      'Content-Type': 'application/json'
    });

    const body: SendForSignatureRequest = {
      leaseId,
      ...options
    };

    return this.http.post<EnvelopeResponse>(
      `${this.apiUrl}/leases/${leaseId}/send-for-signature`,
      body,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error sending for signature:', error);
        return throwError(() => error);
      })
    );
  }

  private getAuthToken(): string {
    // Implement your token retrieval logic
    return localStorage.getItem('auth_token') || '';
  }
}

// Component usage
export class LeaseDetailComponent {
  constructor(private docuSignService: DocuSignService) {}

  sendForSignature(leaseId: string) {
    this.docuSignService.sendForSignature(leaseId).subscribe({
      next: (response) => {
        console.log('Sent successfully:', response.envelopeId);
        // Update UI
      },
      error: (error) => {
        console.error('Failed to send:', error);
        // Show error message
      }
    });
  }
}
```

### Vanilla JavaScript/Fetch API

```javascript
class DocuSignAPI {
  constructor(baseUrl, getAuthToken) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
  }

  async sendForSignature(leaseId, options = {}) {
    try {
      const response = await fetch(
        `${this.baseUrl}/leases/${leaseId}/send-for-signature`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            leaseId,
            ...options
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send for signature');
      }

      return await response.json();
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
}

// Usage
const api = new DocuSignAPI(
  'http://localhost:4010',
  () => localStorage.getItem('auth_token')
);

// Basic usage
api.sendForSignature('507f1f77bcf86cd799439011')
  .then(response => {
    console.log('Envelope ID:', response.envelopeId);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// With custom email
api.sendForSignature('507f1f77bcf86cd799439011', {
  recipientEmail: 'custom@example.com'
})
  .then(response => {
    console.log('Sent to custom email:', response.envelopeId);
  });

// With signature position
api.sendForSignature('507f1f77bcf86cd799439011', {
  signaturePosition: {
    pageNumber: 1,
    xPosition: 100,
    yPosition: 200
  }
})
  .then(response => {
    console.log('Sent with custom position:', response.envelopeId);
  });
```

---

## Status Flow

### Signature Status Lifecycle

```
DRAFT
  ↓ (Send for signature)
PENDING_SIGNATURE
  ↓ (Tenant signs document)
SIGNED
```

Or:

```
PENDING_SIGNATURE
  ↓ (Void/cancel signature request)
VOIDED
```

### Tracking Status Changes

The backend automatically updates the lease status via webhooks from DocuSign. Your frontend should:

1. **After sending for signature:**
   - Update UI to show `PENDING_SIGNATURE` status
   - Display "Awaiting Signature" or similar message
   - Optionally show the envelope ID

2. **Polling for updates (optional):**
   ```javascript
   async function pollLeaseStatus(leaseId) {
     const interval = setInterval(async () => {
       const lease = await fetchLease(leaseId);
       
       if (lease.signatureStatus === 'SIGNED') {
         console.log('Document signed!');
         clearInterval(interval);
         // Update UI to show signed status
         // Display signed document link
       }
     }, 10000); // Poll every 10 seconds
   }
   ```

3. **Real-time updates (recommended):**
   - Implement WebSocket connection for real-time status updates
   - Or use Server-Sent Events (SSE)
   - Backend can push status changes to connected clients

### Status Display Recommendations

```typescript
const getStatusDisplay = (status: SignatureStatus) => {
  switch (status) {
    case 'DRAFT':
      return {
        label: 'Draft',
        color: 'gray',
        icon: 'document',
        action: 'Send for Signature'
      };
    case 'PENDING_SIGNATURE':
      return {
        label: 'Awaiting Signature',
        color: 'yellow',
        icon: 'clock',
        action: 'View Status'
      };
    case 'SIGNED':
      return {
        label: 'Signed',
        color: 'green',
        icon: 'check',
        action: 'Download Signed Document'
      };
    case 'VOIDED':
      return {
        label: 'Cancelled',
        color: 'red',
        icon: 'x',
        action: 'Resend'
      };
  }
};
```

---

## Best Practices

### 1. Error Handling

Always handle errors gracefully and provide user-friendly messages:

```typescript
try {
  const result = await sendForSignature(leaseId);
  showSuccessMessage('Lease sent for signature successfully');
} catch (error) {
  if (error.statusCode === 404) {
    showErrorMessage('Lease not found');
  } else if (error.statusCode === 400) {
    showErrorMessage('Invalid request. Please check the form.');
  } else {
    showErrorMessage('Failed to send lease. Please try again.');
  }
}
```

### 2. Loading States

Show loading indicators during API calls:

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleSend = async () => {
  setIsLoading(true);
  try {
    await sendForSignature(leaseId);
  } finally {
    setIsLoading(false);
  }
};
```

### 3. Validation

Validate data before sending:

```typescript
const validateEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const handleSend = async () => {
  if (recipientEmail && !validateEmail(recipientEmail)) {
    showError('Please enter a valid email address');
    return;
  }
  
  await sendForSignature(leaseId, { recipientEmail });
};
```

### 4. Retry Logic

Implement retry logic for transient failures:

```typescript
async function sendWithRetry(leaseId: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendForSignature(leaseId);
    } catch (error) {
      if (attempt === maxRetries || error.statusCode < 500) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### 5. User Feedback

Provide clear feedback at each step:

```typescript
// Before sending
showInfo('Preparing to send lease for signature...');

// During sending
showLoading('Sending lease to DocuSign...');

// After success
showSuccess('Lease sent! The tenant will receive an email shortly.');

// After error
showError('Failed to send lease. Please try again or contact support.');
```

---

## Testing

### Test Checklist

- [ ] Send lease with default tenant email
- [ ] Send lease with custom recipient email
- [ ] Send lease with custom signature position
- [ ] Handle 401 Unauthorized error
- [ ] Handle 404 Not Found error
- [ ] Handle 400 Bad Request error
- [ ] Handle 500 Internal Server Error
- [ ] Display loading state during API call
- [ ] Update UI after successful send
- [ ] Show error message on failure

### Mock Data for Testing

```typescript
// Mock successful response
const mockSuccessResponse = {
  envelopeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  status: 'sent',
  statusDateTime: '2024-01-15T10:30:00.000Z',
  uri: '/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890'
};

// Mock error response
const mockErrorResponse = {
  statusCode: 404,
  message: 'Lease not found',
  error: 'Not Found',
  timestamp: '2024-01-15T10:30:00.000Z',
  path: '/leases/invalid-id/send-for-signature'
};
```

---

## Support

For questions or issues:
- Backend API issues: Contact backend team
- DocuSign account issues: Contact DocuSign support
- Integration questions: Refer to this documentation or contact the integration team

---

## Changelog

### Version 1.0.0 (Current)
- Initial release
- Send lease for signature endpoint
- Support for custom recipient email
- Support for custom signature position
- Comprehensive error handling
