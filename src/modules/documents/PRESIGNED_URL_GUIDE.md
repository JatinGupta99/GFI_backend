# Document Management API - Presigned URL Approach

## Overview

This API provides a **presigned URL approach** for document management where:
1. Frontend requests a presigned URL from the backend
2. Frontend uploads directly to S3 using the presigned URL
3. Backend stores document metadata in the database
4. No files pass through the backend server (efficient and scalable)

---

## 🔄 Upload Flow

```
┌─────────────┐    1. Request Upload URL    ┌─────────────┐
│   Frontend  │ ──────────────────────────► │   Backend   │
└─────────────┘                             └─────────────┘
       │                                           │
       │                                           │ 2. Generate S3 URL
       │                                           │    Store metadata (pending)
       │                                           ▼
       │                                    ┌─────────────┐
       │                                    │  Database   │
       │                                    └─────────────┘
       │                                           │
       │    3. Return Upload URL + Key             │
       │ ◄─────────────────────────────────────────┘
       │
       │    4. Upload directly to S3
       ▼
┌─────────────┐
│     S3      │
└─────────────┘
       │
       │    5. Confirm Upload Success
       ▼
┌─────────────┐    6. Confirm Upload      ┌─────────────┐
│   Frontend  │ ──────────────────────────► │   Backend   │
└─────────────┘                             └─────────────┘
                                                   │
                                                   │ 7. Update status to 'uploaded'
                                                   ▼
                                            ┌─────────────┐
                                            │  Database   │
                                            └─────────────┘
```

---

## 📚 API Endpoints

### 1. Generate Upload URL

**Request:**
```http
POST /api/documents/upload-url
Content-Type: application/json

{
  "fileName": "contract.pdf",
  "contentType": "application/pdf",
  "size": 1024000,
  "folder": "contracts",
  "uploadedBy": "user123",
  "description": "Service contract",
  "category": "legal",
  "tags": {
    "department": "legal",
    "priority": "high"
  },
  "metadata": {
    "clientId": "client456",
    "projectId": "project789"
  }
}
```

**Response:**
```json
{
  "key": "contracts/uuid-generated-key.pdf",
  "uploadUrl": "https://bucket.s3.amazonaws.com/contracts/uuid?X-Amz-Algorithm=...",
  "expiresIn": 3600,
  "fileName": "contract.pdf",
  "documentId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "warnings": []
}
```

### 2. Confirm Upload

**Request:**
```http
POST /api/documents/confirm-upload
Content-Type: application/json

{
  "key": "contracts/uuid-generated-key.pdf",
  "actualSize": 1024000
}
```

**Response:**
```json
{
  "id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "key": "contracts/uuid-generated-key.pdf",
  "fileName": "contract.pdf",
  "originalFileName": "contract.pdf",
  "contentType": "application/pdf",
  "size": 1024000,
  "status": "uploaded",
  "folder": "contracts",
  "uploadedBy": "user123",
  "description": "Service contract",
  "category": "legal",
  "tags": {
    "department": "legal",
    "priority": "high"
  },
  "createdAt": "2024-01-01T10:00:00.000Z",
  "uploadedAt": "2024-01-01T10:05:00.000Z",
  "downloadUrl": "https://bucket.s3.amazonaws.com/contracts/uuid?X-Amz-Algorithm=..."
}
```

### 3. List Documents

**Request:**
```http
GET /api/documents?page=1&limit=20&category=legal&status=uploaded&uploadedBy=user123
```

**Response:**
```json
{
  "documents": [
    {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "key": "contracts/uuid-generated-key.pdf",
      "fileName": "contract.pdf",
      "originalFileName": "contract.pdf",
      "contentType": "application/pdf",
      "size": 1024000,
      "status": "uploaded",
      "folder": "contracts",
      "uploadedBy": "user123",
      "description": "Service contract",
      "category": "legal",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "uploadedAt": "2024-01-01T10:05:00.000Z",
      "downloadUrl": "https://bucket.s3.amazonaws.com/..."
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### 4. Generate Download URL

**Request:**
```http
GET /api/documents/contracts%2Fuuid-generated-key.pdf/download-url?expiresIn=3600&inline=false&fileName=contract.pdf
```

**Response:**
```json
{
  "url": "https://bucket.s3.amazonaws.com/contracts/uuid?X-Amz-Algorithm=...",
  "expiresIn": 3600
}
```

### 5. Get Document Info

**Request:**
```http
GET /api/documents/contracts%2Fuuid-generated-key.pdf/info
```

**Response:**
```json
{
  "id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "key": "contracts/uuid-generated-key.pdf",
  "fileName": "contract.pdf",
  "originalFileName": "contract.pdf",
  "contentType": "application/pdf",
  "size": 1024000,
  "status": "uploaded",
  "folder": "contracts",
  "uploadedBy": "user123",
  "description": "Service contract",
  "category": "legal",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "uploadedAt": "2024-01-01T10:05:00.000Z",
  "downloadUrl": "https://bucket.s3.amazonaws.com/..."
}
```

### 6. Update Document Metadata

**Request:**
```http
PUT /api/documents/contracts%2Fuuid-generated-key.pdf
Content-Type: application/json

{
  "description": "Updated service contract",
  "category": "legal-updated",
  "tags": {
    "department": "legal",
    "priority": "medium",
    "reviewed": "true"
  }
}
```

### 7. Delete Document

**Request:**
```http
DELETE /api/documents/contracts%2Fuuid-generated-key.pdf
```

**Response:**
```json
{
  "message": "Document deleted successfully"
}
```

---

## 💻 Frontend Implementation

### React/JavaScript Example

```javascript
class DocumentUploader {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
  }

  async uploadDocument(file, metadata = {}) {
    try {
      // Step 1: Get upload URL
      const uploadUrlResponse = await fetch(`${this.apiBaseUrl}/documents/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          ...metadata,
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { key, uploadUrl, documentId } = await uploadUrlResponse.json();

      // Step 2: Upload directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        // Mark upload as failed
        await this.markUploadFailed(key);
        throw new Error('Failed to upload to S3');
      }

      // Step 3: Confirm upload
      const confirmResponse = await fetch(`${this.apiBaseUrl}/documents/confirm-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          key,
          actualSize: file.size,
        }),
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm upload');
      }

      const documentInfo = await confirmResponse.json();
      
      return {
        success: true,
        document: documentInfo,
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async markUploadFailed(key) {
    try {
      await fetch(`${this.apiBaseUrl}/documents/${encodeURIComponent(key)}/mark-failed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });
    } catch (error) {
      console.error('Failed to mark upload as failed:', error);
    }
  }

  async downloadDocument(key, fileName) {
    try {
      // Get download URL
      const response = await fetch(
        `${this.apiBaseUrl}/documents/${encodeURIComponent(key)}/download-url?fileName=${encodeURIComponent(fileName)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const { url } = await response.json();

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async listDocuments(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await fetch(
        `${this.apiBaseUrl}/documents?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to list documents: ${error.message}`);
    }
  }
}

// Usage
const uploader = new DocumentUploader('http://localhost:4020/api', 'your-auth-token');

// Upload a document
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];

const result = await uploader.uploadDocument(file, {
  folder: 'contracts',
  uploadedBy: 'user123',
  description: 'Important contract',
  category: 'legal',
  tags: {
    department: 'legal',
    priority: 'high',
  },
});

if (result.success) {
  console.log('Document uploaded:', result.document);
} else {
  console.error('Upload failed:', result.error);
}

// List documents
const documents = await uploader.listDocuments({
  category: 'legal',
  status: 'uploaded',
  page: 1,
  limit: 20,
});

// Download a document
await uploader.downloadDocument(documents.documents[0].key, documents.documents[0].fileName);
```

### React Hook Example

```javascript
import { useState, useCallback } from 'react';

export function useDocumentUpload(apiBaseUrl, authToken) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadDocument = useCallback(async (file, metadata = {}) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get upload URL (10% progress)
      setProgress(10);
      const uploadUrlResponse = await fetch(`${apiBaseUrl}/documents/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          ...metadata,
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { key, uploadUrl } = await uploadUrlResponse.json();

      // Step 2: Upload to S3 (10% to 80% progress)
      setProgress(20);
      
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 60 + 20; // 20% to 80%
            setProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      await uploadPromise;

      // Step 3: Confirm upload (80% to 100% progress)
      setProgress(90);
      const confirmResponse = await fetch(`${apiBaseUrl}/documents/confirm-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          key,
          actualSize: file.size,
        }),
      });

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm upload');
      }

      const documentInfo = await confirmResponse.json();
      setProgress(100);

      return documentInfo;

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [apiBaseUrl, authToken]);

  return {
    uploadDocument,
    uploading,
    progress,
    error,
  };
}

// Usage in component
function DocumentUploadComponent() {
  const { uploadDocument, uploading, progress, error } = useDocumentUpload(
    'http://localhost:4020/api',
    'your-auth-token'
  );

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const document = await uploadDocument(file, {
        folder: 'uploads',
        uploadedBy: 'current-user',
        category: 'general',
      });
      
      console.log('Upload successful:', document);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileUpload} disabled={uploading} />
      
      {uploading && (
        <div>
          <div>Uploading... {Math.round(progress)}%</div>
          <div style={{ width: '100%', backgroundColor: '#f0f0f0' }}>
            <div 
              style={{ 
                width: `${progress}%`, 
                backgroundColor: '#007bff', 
                height: '20px' 
              }} 
            />
          </div>
        </div>
      )}
      
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}
```

---

## 🗄️ Database Schema

The system stores document metadata in MongoDB:

```javascript
{
  _id: ObjectId("64f8a1b2c3d4e5f6a7b8c9d0"),
  key: "contracts/uuid-generated-key.pdf",
  fileName: "contract.pdf",
  originalFileName: "contract.pdf",
  contentType: "application/pdf",
  size: 1024000,
  folder: "contracts",
  uploadedBy: "user123",
  description: "Service contract",
  category: "legal",
  tags: {
    department: "legal",
    priority: "high"
  },
  metadata: {
    clientId: "client456",
    projectId: "project789"
  },
  status: "uploaded", // pending | uploaded | failed
  uploadedAt: ISODate("2024-01-01T10:05:00.000Z"),
  expiresAt: ISODate("2024-01-01T11:00:00.000Z"), // For cleanup of pending uploads
  createdAt: ISODate("2024-01-01T10:00:00.000Z"),
  updatedAt: ISODate("2024-01-01T10:05:00.000Z")
}
```

---

## 🔧 Configuration

Add to your `app.module.ts`:

```typescript
import { DocumentsModule } from './modules/documents/documents.module';

@Module({
  imports: [
    // ... other modules
    DocumentsModule,
  ],
})
export class AppModule {}
```

Environment variables:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_DEFAULT_EXPIRES_IN=3600

# MongoDB (if not already configured)
MONGODB_URI=mongodb://localhost:27017/your-database

# Document Configuration
DOCUMENTS_MAX_FILE_SIZE=52428800  # 50MB
DOCUMENTS_MIN_FILE_SIZE=1
```

---

## 🧹 Cleanup & Maintenance

### Automatic Cleanup

The system includes automatic cleanup of expired pending uploads:

```http
POST /api/documents/cleanup-expired
```

This will:
1. Find documents with `status: 'pending'` and `expiresAt < now`
2. Delete them from both S3 and database
3. Return count of cleaned documents

### Scheduled Cleanup (Optional)

You can set up a cron job to run cleanup automatically:

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DocumentCleanupService {
  constructor(private documentManager: DocumentManagerService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredDocuments() {
    await this.documentManager.cleanupExpiredDocuments();
  }
}
```

---

## ✅ Benefits

### Performance
✅ **No server load** - Files don't pass through backend  
✅ **Direct S3 upload** - Faster uploads  
✅ **Scalable** - No server storage needed  
✅ **Parallel uploads** - Multiple files can upload simultaneously  

### Security
✅ **Presigned URLs** - Temporary, secure access  
✅ **File validation** - Before upload URL generation  
✅ **Access control** - Backend controls who gets URLs  
✅ **Expiration** - URLs expire automatically  

### Reliability
✅ **Status tracking** - Know if uploads succeeded  
✅ **Metadata storage** - Rich document information  
✅ **Error handling** - Failed uploads are tracked  
✅ **Cleanup** - Expired pending uploads are cleaned  

### SOLID Principles
✅ **Single Responsibility** - Each service has one job  
✅ **Open/Closed** - Easy to extend with new storage providers  
✅ **Liskov Substitution** - Storage implementations are interchangeable  
✅ **Interface Segregation** - Focused interfaces  
✅ **Dependency Inversion** - Depends on abstractions  

---

**Your presigned URL document management system is ready!** 🚀

The system provides a complete solution for document management with presigned URLs, database metadata storage, and comprehensive SOLID-principle architecture.