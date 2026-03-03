# Document Management API - Frontend Integration Guide

## Overview

This document provides complete API documentation for the Document Management System. The system uses **presigned URLs** for direct S3 uploads, meaning files are uploaded directly from the frontend to S3, not through our backend.

## Base URL
```
http://localhost:4020/api/documents
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your-jwt-token>
```

---

## API Endpoints

### 1. Generate Upload URL
**POST** `/upload-url`

Generates a presigned URL for uploading a file directly to S3.

#### Request Body
```json
{
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "size": 1048576,
  "folder": "contracts",
  "uploadedBy": "user123",
  "description": "Contract document",
  "category": "legal",
  "tags": {
    "department": "legal",
    "priority": "high"
  },
  "metadata": {
    "clientId": "client123",
    "projectId": "proj456"
  }
}
```

#### Request Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fileName | string | ✅ | Original filename with extension |
| contentType | string | ✅ | MIME type (e.g., "application/pdf") |
| size | number | ❌ | File size in bytes |
| folder | string | ❌ | S3 folder/prefix for organization |
| uploadedBy | string | ❌ | User ID who is uploading |
| description | string | ❌ | File description |
| category | string | ❌ | Document category |
| tags | object | ❌ | Key-value pairs for tagging |
| metadata | object | ❌ | Additional metadata |

#### Response
```json
{
  "success": true,
  "data": {
    "key": "documents/2024/03/uuid-document.pdf",
    "uploadUrl": "https://bucket.s3.amazonaws.com/...",
    "expiresIn": 3600,
    "fileName": "document.pdf",
    "documentId": "65f1234567890abcdef12345",
    "warnings": ["File extension '.pdf' is not in the allowed list"]
  }
}
```

### 2. Confirm Upload
**POST** `/confirm-upload`

Confirms that the file was successfully uploaded to S3.

#### Request Body
```json
{
  "key": "documents/2024/03/uuid-document.pdf",
  "actualSize": 1048576
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "65f1234567890abcdef12345",
    "key": "documents/2024/03/uuid-document.pdf",
    "fileName": "document.pdf",
    "originalFileName": "document.pdf",
    "contentType": "application/pdf",
    "size": 1048576,
    "status": "uploaded",
    "folder": "contracts",
    "uploadedBy": "user123",
    "description": "Contract document",
    "category": "legal",
    "tags": {
      "department": "legal",
      "priority": "high"
    },
    "createdAt": "2024-03-03T10:00:00.000Z",
    "uploadedAt": "2024-03-03T10:01:00.000Z",
    "downloadUrl": "https://bucket.s3.amazonaws.com/..."
  }
}
```

### 3. Generate Download URL
**GET** `/download/:key`

Generates a presigned URL for downloading a file from S3.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| expiresIn | number | URL expiration in seconds (default: 3600) |
| inline | boolean | If true, opens in browser; if false, downloads |
| fileName | string | Custom filename for download |

#### Example
```
GET /download/documents%2F2024%2F03%2Fuuid-document.pdf?expiresIn=7200&inline=false&fileName=my-document.pdf
```

#### Response
```json
{
  "success": true,
  "data": {
    "url": "https://bucket.s3.amazonaws.com/...",
    "expiresIn": 7200
  }
}
```

### 4. Get Document Info
**GET** `/info/:key`

Retrieves document metadata by S3 key.

#### Response
```json
{
  "success": true,
  "data": {
    "id": "65f1234567890abcdef12345",
    "key": "documents/2024/03/uuid-document.pdf",
    "fileName": "document.pdf",
    "originalFileName": "document.pdf",
    "contentType": "application/pdf",
    "size": 1048576,
    "status": "uploaded",
    "folder": "contracts",
    "uploadedBy": "user123",
    "description": "Contract document",
    "category": "legal",
    "tags": {
      "department": "legal",
      "priority": "high"
    },
    "createdAt": "2024-03-03T10:00:00.000Z",
    "uploadedAt": "2024-03-03T10:01:00.000Z",
    "downloadUrl": "https://bucket.s3.amazonaws.com/..."
  }
}
```

### 5. Get Document by ID
**GET** `/:id`

Retrieves document metadata by database ID.

#### Response
Same as "Get Document Info" above.

### 6. List Documents
**GET** `/`

Lists documents with pagination and filtering.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| uploadedBy | string | Filter by uploader |
| category | string | Filter by category |
| status | string | Filter by status (pending/uploaded/failed) |
| folder | string | Filter by folder |

#### Example
```
GET /?page=1&limit=10&category=legal&uploadedBy=user123
```

#### Response
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "65f1234567890abcdef12345",
        "key": "documents/2024/03/uuid-document.pdf",
        "fileName": "document.pdf",
        "originalFileName": "document.pdf",
        "contentType": "application/pdf",
        "size": 1048576,
        "status": "uploaded",
        "folder": "contracts",
        "uploadedBy": "user123",
        "description": "Contract document",
        "category": "legal",
        "createdAt": "2024-03-03T10:00:00.000Z",
        "uploadedAt": "2024-03-03T10:01:00.000Z",
        "downloadUrl": "https://bucket.s3.amazonaws.com/..."
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### 7. Update Document
**PATCH** `/:key`

Updates document metadata.

#### Request Body
```json
{
  "description": "Updated description",
  "category": "updated-category",
  "tags": {
    "status": "reviewed"
  }
}
```

#### Response
Same as "Get Document Info" above.

### 8. Delete Document
**DELETE** `/:key`

Deletes a document from both S3 and database.

#### Response
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

## Frontend Implementation Examples

### React/JavaScript Upload Example

```javascript
// 1. Get upload URL
const getUploadUrl = async (file, metadata = {}) => {
  const response = await fetch('/api/documents/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      ...metadata
    })
  });
  
  return response.json();
};

// 2. Upload to S3
const uploadToS3 = async (file, uploadUrl) => {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  });
  
  return response.ok;
};

// 3. Confirm upload
const confirmUpload = async (key, actualSize) => {
  const response = await fetch('/api/documents/confirm-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      key,
      actualSize
    })
  });
  
  return response.json();
};

// Complete upload flow
const uploadDocument = async (file, metadata = {}) => {
  try {
    // Step 1: Get upload URL
    const urlResponse = await getUploadUrl(file, metadata);
    if (!urlResponse.success) {
      throw new Error('Failed to get upload URL');
    }
    
    const { uploadUrl, key } = urlResponse.data;
    
    // Step 2: Upload to S3
    const uploadSuccess = await uploadToS3(file, uploadUrl);
    if (!uploadSuccess) {
      throw new Error('Failed to upload to S3');
    }
    
    // Step 3: Confirm upload
    const confirmResponse = await confirmUpload(key, file.size);
    if (!confirmResponse.success) {
      throw new Error('Failed to confirm upload');
    }
    
    return confirmResponse.data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// Usage
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const document = await uploadDocument(file, {
      folder: 'user-uploads',
      category: 'general',
      description: 'User uploaded file'
    });
    
    console.log('Upload successful:', document);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### React Upload Component Example

```jsx
import React, { useState } from 'react';

const DocumentUpload = ({ onUploadSuccess, onUploadError }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // Get upload URL
      setProgress(10);
      const urlResponse = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          folder: 'user-uploads',
          category: 'general'
        })
      });

      const urlData = await urlResponse.json();
      if (!urlData.success) {
        throw new Error(urlData.message || 'Failed to get upload URL');
      }

      // Upload to S3
      setProgress(50);
      const uploadResponse = await fetch(urlData.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Confirm upload
      setProgress(90);
      const confirmResponse = await fetch('/api/documents/confirm-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          key: urlData.data.key,
          actualSize: file.size
        })
      });

      const confirmData = await confirmResponse.json();
      if (!confirmData.success) {
        throw new Error('Failed to confirm upload');
      }

      setProgress(100);
      onUploadSuccess?.(confirmData.data);
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="document-upload">
      <input
        type="file"
        onChange={handleFileSelect}
        disabled={uploading}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
      />
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
```

---

## Error Handling

### Common Error Responses

```json
{
  "success": false,
  "message": "Validation failed: File size exceeds maximum allowed size",
  "statusCode": 400
}
```

### Error Status Codes
- **400**: Bad Request (validation errors, invalid parameters)
- **401**: Unauthorized (missing or invalid token)
- **404**: Not Found (document not found)
- **500**: Internal Server Error

### Validation Rules

#### File Size Limits
- **Images**: 10MB maximum
- **PDFs**: 25MB maximum  
- **Other files**: 50MB maximum
- **Minimum**: 1 byte

#### Allowed Content Types
- **Images**: jpeg, png, gif, webp, svg
- **Documents**: pdf, doc, docx, xls, xlsx, ppt, pptx
- **Text**: txt, csv, json, xml
- **Archives**: zip, rar, 7z

#### Blocked Extensions
`.exe`, `.bat`, `.cmd`, `.com`, `.scr`, `.pif`, `.js`, `.vbs`, `.jar`, `.app`, `.deb`, `.pkg`

---

## Best Practices

### 1. File Validation
Always validate files on the frontend before uploading:
```javascript
const validateFile = (file) => {
  const maxSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  
  if (file.size > maxSize) {
    throw new Error('File too large');
  }
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not allowed');
  }
};
```

### 2. Progress Tracking
Show upload progress to users:
```javascript
const uploadWithProgress = async (file, onProgress) => {
  // Implementation with progress callbacks
};
```

### 3. Error Recovery
Handle upload failures gracefully:
```javascript
const uploadWithRetry = async (file, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadDocument(file);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### 4. Security
- Always validate file types and sizes
- Use HTTPS for all requests
- Store JWT tokens securely
- Implement proper error handling

---

## Testing

### Test Upload Flow
```bash
# 1. Get upload URL
curl -X POST http://localhost:4020/api/documents/upload-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.pdf",
    "contentType": "application/pdf",
    "size": 1024
  }'

# 2. Upload to S3 (use the uploadUrl from step 1)
curl -X PUT "PRESIGNED_URL_FROM_STEP_1" \
  -H "Content-Type: application/pdf" \
  --data-binary @test.pdf

# 3. Confirm upload
curl -X POST http://localhost:4020/api/documents/confirm-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "KEY_FROM_STEP_1",
    "actualSize": 1024
  }'
```

---

## Support

For questions or issues:
1. Check the error response messages
2. Verify authentication tokens
3. Ensure file meets validation requirements
4. Contact the backend team with specific error details

---

**Last Updated**: March 3, 2026
**API Version**: 1.0.0