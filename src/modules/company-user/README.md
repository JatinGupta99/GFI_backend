# Company User Module

## Signature Upload and Download

This module provides endpoints for uploading and downloading user signatures using pre-signed URLs with automatic database key updates.

## Complete Workflow

### 1. Get Upload URL
### 2. Upload File to S3
### 3. Update Database with S3 Key
### 4. Download Signature

---

## cURL Commands

### Step 1: Get Pre-signed Upload URL

```bash
curl -X POST http://localhost:3000/company-user/{userId}/signature-upload-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"contentType": "image/png"}'
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Signed URL generated",
  "data": {
    "key": "company-users/{userId}/signature/{uuid}.png",
    "url": "https://s3.amazonaws.com/bucket/company-users/{userId}/signature/{uuid}.png?..."
  }
}
```

### Step 2: Upload File to S3

```bash
curl -X PUT "{PRESIGNED_URL_FROM_STEP_1}" \
  -H "Content-Type: image/png" \
  --data-binary @signature.png
```

### Step 3: Update Database with S3 Key

```bash
curl -X PATCH http://localhost:3000/company-user/{userId}/signature \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"key": "company-users/{userId}/signature/{uuid}.png"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Signature updated successfully",
  "data": {
    "_id": "userId",
    "name": "John Doe",
    "email": "john@example.com",
    "signature": "company-users/{userId}/signature/{uuid}.png",
    ...
  }
}
```

### Step 4: Get Download URL

```bash
curl -X GET http://localhost:3000/company-user/{userId}/signature-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "statusCode": 200,
  "url": "https://s3.amazonaws.com/bucket/company-users/{userId}/signature/{uuid}.png?..."
}
```

---

## Complete Bash Script Example

```bash
#!/bin/bash

# Configuration
USER_ID="your-user-id-here"
JWT_TOKEN="your-jwt-token-here"
SIGNATURE_FILE="path/to/signature.png"
API_BASE="http://localhost:3000"

# Step 1: Get upload URL
echo "Step 1: Getting upload URL..."
UPLOAD_RESPONSE=$(curl -s -X POST "${API_BASE}/company-user/${USER_ID}/signature-upload-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -d '{"contentType": "image/png"}')

echo "Upload Response: ${UPLOAD_RESPONSE}"

# Extract URL and key (requires jq)
PRESIGNED_URL=$(echo $UPLOAD_RESPONSE | jq -r '.data.url')
S3_KEY=$(echo $UPLOAD_RESPONSE | jq -r '.data.key')

echo "Presigned URL: ${PRESIGNED_URL}"
echo "S3 Key: ${S3_KEY}"

# Step 2: Upload file to S3
echo "Step 2: Uploading file to S3..."
UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${PRESIGNED_URL}" \
  -H "Content-Type: image/png" \
  --data-binary @"${SIGNATURE_FILE}")

if [ "$UPLOAD_STATUS" -eq 200 ]; then
  echo "Upload successful!"
  
  # Step 3: Update database with S3 key
  echo "Step 3: Updating database..."
  UPDATE_RESPONSE=$(curl -s -X PATCH "${API_BASE}/company-user/${USER_ID}/signature" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -d "{\"key\": \"${S3_KEY}\"}")
  
  echo "Update Response: ${UPDATE_RESPONSE}"
  
  # Step 4: Get download URL
  echo "Step 4: Getting download URL..."
  DOWNLOAD_RESPONSE=$(curl -s -X GET "${API_BASE}/company-user/${USER_ID}/signature-url" \
    -H "Authorization: Bearer ${JWT_TOKEN}")
  
  echo "Download Response: ${DOWNLOAD_RESPONSE}"
else
  echo "Upload failed with status: ${UPLOAD_STATUS}"
fi
```

---

## Frontend Integration Guide

### React/TypeScript Example

```typescript
// types.ts
export interface SignatureUploadResponse {
  statusCode: number;
  message: string;
  data: {
    key: string;
    url: string;
  };
}

export interface SignatureDownloadResponse {
  statusCode: number;
  url: string;
}

// signatureService.ts
class SignatureService {
  private apiBase = 'http://localhost:3000';
  
  async uploadSignature(userId: string, file: File, token: string): Promise<string> {
    try {
      // Step 1: Get pre-signed upload URL
      const uploadUrlResponse = await fetch(
        `${this.apiBase}/company-user/${userId}/signature-upload-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            contentType: file.type,
          }),
        }
      );

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const uploadData: SignatureUploadResponse = await uploadUrlResponse.json();
      const { url: presignedUrl, key: s3Key } = uploadData.data;

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Step 3: Update database with S3 key
      const updateResponse = await fetch(
        `${this.apiBase}/company-user/${userId}/signature`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ key: s3Key }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error('Failed to update signature in database');
      }

      return s3Key;
    } catch (error) {
      console.error('Error uploading signature:', error);
      throw error;
    }
  }

  async getSignatureUrl(userId: string, token: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.apiBase}/company-user/${userId}/signature-url`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get signature URL');
      }

      const data: SignatureDownloadResponse = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error getting signature URL:', error);
      throw error;
    }
  }
}

export const signatureService = new SignatureService();
```

### React Component Example

```tsx
import React, { useState } from 'react';
import { signatureService } from './signatureService';

interface SignatureUploadProps {
  userId: string;
  token: string;
}

export const SignatureUpload: React.FC<SignatureUploadProps> = ({ userId, token }) => {
  const [uploading, setUploading] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PNG, JPEG, or WebP image');
      return;
    }

    // Validate file size (e.g., max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload signature
      await signatureService.uploadSignature(userId, file, token);
      
      // Get download URL to display
      const url = await signatureService.getSignatureUrl(userId, token);
      setSignatureUrl(url);
      
      alert('Signature uploaded successfully!');
    } catch (err) {
      setError('Failed to upload signature. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const loadSignature = async () => {
    try {
      const url = await signatureService.getSignatureUrl(userId, token);
      setSignatureUrl(url);
    } catch (err) {
      console.error('No signature found or error loading signature');
    }
  };

  React.useEffect(() => {
    loadSignature();
  }, [userId, token]);

  return (
    <div className="signature-upload">
      <h3>Upload Signature</h3>
      
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
      />
      
      {uploading && <p>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {signatureUrl && (
        <div className="signature-preview">
          <h4>Current Signature:</h4>
          <img src={signatureUrl} alt="User signature" style={{ maxWidth: '300px' }} />
        </div>
      )}
    </div>
  );
};
```

---

## API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/company-user/:id/signature-upload-url` | Get pre-signed upload URL | Yes |
| PATCH | `/company-user/:id/signature` | Update signature key in DB | Yes |
| GET | `/company-user/:id/signature-url` | Get signature download URL | Yes |

---

## Request/Response Details

### POST `/company-user/:id/signature-upload-url`

**Request Body:**
```json
{
  "contentType": "image/png" // or "image/jpeg", "image/webp"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Signed URL generated",
  "data": {
    "key": "company-users/{userId}/signature/{uuid}.png",
    "url": "https://s3.amazonaws.com/..."
  }
}
```

### PATCH `/company-user/:id/signature`

**Request Body:**
```json
{
  "key": "company-users/{userId}/signature/{uuid}.png"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Signature updated successfully",
  "data": {
    "_id": "userId",
    "signature": "company-users/{userId}/signature/{uuid}.png",
    ...
  }
}
```

### GET `/company-user/:id/signature-url`

**Response:**
```json
{
  "statusCode": 200,
  "url": "https://s3.amazonaws.com/..."
}
```

---

## Error Handling

### Common Errors

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**400 Bad Request - Invalid Content Type:**
```json
{
  "statusCode": 400,
  "message": "Invalid content type. Allowed types: image/jpeg, image/png, image/webp"
}
```

**404 Not Found - No Signature:**
```json
{
  "statusCode": 404,
  "message": "User has no signature"
}
```

**400 Bad Request - Unauthorized Access:**
```json
{
  "statusCode": 400,
  "message": "Unauthorized to upload signature for this user"
}
```

---

## Notes

- Pre-signed URLs expire after a set time (typically 15 minutes)
- Supported content types: `image/png`, `image/jpeg`, `image/webp`
- Users can only upload/access their own signatures
- The S3 key is automatically stored in the database after successful upload
- Download URLs are also temporary and expire after a set time
