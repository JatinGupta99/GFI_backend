# Document Management API - SOLID Principles Implementation

## Overview

A comprehensive, SOLID-principle compliant document management system for uploading, downloading, and managing documents in S3 storage.

## SOLID Principles Applied

### 1. Single Responsibility Principle (SRP)
- **DocumentManagerService**: Orchestrates document operations
- **S3DocumentStorageService**: Handles S3 storage operations only
- **DocumentValidatorService**: Handles file validation only
- **DocumentsController**: Handles HTTP requests/responses only

### 2. Open/Closed Principle (OCP)
- **Interfaces**: `IDocumentStorage`, `IDocumentValidator` allow extension without modification
- **New storage providers**: Can implement `IDocumentStorage` (Azure, GCP, etc.)
- **New validators**: Can implement `IDocumentValidator` (virus scanning, AI content analysis, etc.)

### 3. Liskov Substitution Principle (LSP)
- Any implementation of `IDocumentStorage` can replace `S3DocumentStorageService`
- Any implementation of `IDocumentValidator` can replace `DocumentValidatorService`

### 4. Interface Segregation Principle (ISP)
- **Focused interfaces**: Each interface has a specific purpose
- **No forced dependencies**: Clients only depend on methods they use

### 5. Dependency Inversion Principle (DIP)
- **High-level modules** depend on abstractions (interfaces)
- **Low-level modules** implement abstractions
- **Dependency injection** used throughout

---

## API Endpoints

### 1. Upload Document (Direct)
```http
POST /api/documents/upload
Content-Type: multipart/form-data

Form Data:
- file: [binary file]
- fileName: string (optional - uses file.originalname)
- folder: string (optional)
- uploadedBy: string (optional)
- description: string (optional)
- category: string (optional)
- tags: object (optional)
```

**Response:**
```json
{
  "key": "documents/uuid.pdf",
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "size": 1024000,
  "uploadedAt": "2024-01-01T00:00:00.000Z",
  "url": "https://s3.amazonaws.com/...",
  "warnings": ["File extension 'pdf' is not in the allowed list"]
}
```

### 2. Generate Upload URL (Pre-signed)
```http
POST /api/documents/upload-url
Content-Type: application/json

{
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "size": 1024000,
  "folder": "contracts",
  "uploadedBy": "user123",
  "description": "Contract document",
  "category": "legal",
  "tags": {
    "department": "legal",
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "key": "contracts/uuid.pdf",
  "uploadUrl": "https://s3.amazonaws.com/...",
  "expiresIn": 3600,
  "fileName": "document.pdf",
  "warnings": []
}
```

### 3. Download Document (Direct)
```http
GET /api/documents/{key}/download
```

**Response:** Binary file with appropriate headers

### 4. Generate Download URL (Pre-signed)
```http
GET /api/documents/{key}/download-url?expiresIn=3600&inline=false&fileName=custom.pdf
```

**Response:**
```json
{
  "url": "https://s3.amazonaws.com/...",
  "expiresIn": 3600
}
```

### 5. Get Document Info
```http
GET /api/documents/{key}/info
```

**Response:**
```json
{
  "exists": true,
  "downloadUrl": "https://s3.amazonaws.com/...",
  "fileName": "document.pdf"
}
```

### 6. Delete Document
```http
DELETE /api/documents/{key}
```

**Response:**
```json
{
  "message": "Document deleted successfully"
}
```

### 7. Move/Rename Document
```http
PUT /api/documents/move
Content-Type: application/json

{
  "oldKey": "documents/old-uuid.pdf",
  "newKey": "contracts/new-uuid.pdf"
}
```

**Response:**
```json
{
  "message": "Document moved successfully"
}
```

### 8. Health Check
```http
GET /api/documents/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Configuration

### Environment Variables

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_DEFAULT_EXPIRES_IN=3600

# Document Configuration
DOCUMENTS_MAX_FILE_SIZE=52428800  # 50MB
DOCUMENTS_MIN_FILE_SIZE=1
DOCUMENTS_SCAN_FOR_MALWARE=false
```

### Configuration Object

```typescript
// config/configuration.ts
export default () => ({
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_S3_BUCKET,
    defaultExpiresIn: parseInt(process.env.AWS_DEFAULT_EXPIRES_IN) || 3600,
  },
  documents: {
    allowedContentTypes: [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Text
      'text/plain', 'text/csv', 'application/json', 'application/xml',
      // Archives
      'application/zip', 'application/x-rar-compressed',
    ],
    maxFileSize: parseInt(process.env.DOCUMENTS_MAX_FILE_SIZE) || 50 * 1024 * 1024,
    minFileSize: parseInt(process.env.DOCUMENTS_MIN_FILE_SIZE) || 1,
    allowedExtensions: [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.json', '.xml', '.zip', '.rar', '.7z',
    ],
    blockedExtensions: [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
      '.js', '.vbs', '.jar', '.app', '.deb', '.pkg',
    ],
    scanForMalware: process.env.DOCUMENTS_SCAN_FOR_MALWARE === 'true',
  },
});
```

---

## Usage Examples

### Frontend Upload (Direct)

```javascript
// Direct upload with form data
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folder', 'contracts');
formData.append('uploadedBy', 'user123');
formData.append('description', 'Important contract');

const response = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Uploaded:', result.key);
```

### Frontend Upload (Pre-signed URL)

```javascript
// Step 1: Get upload URL
const uploadUrlResponse = await fetch('/api/documents/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    folder: 'contracts',
    uploadedBy: 'user123',
  }),
});

const { key, uploadUrl } = await uploadUrlResponse.json();

// Step 2: Upload directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});

console.log('Uploaded to:', key);
```

### Frontend Download

```javascript
// Get download URL
const response = await fetch(`/api/documents/${key}/download-url?inline=true`);
const { url } = await response.json();

// Open in new tab or download
window.open(url, '_blank');

// Or direct download
const downloadResponse = await fetch(`/api/documents/${key}/download`);
const blob = await downloadResponse.blob();
const downloadUrl = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = downloadUrl;
a.download = 'document.pdf';
a.click();
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DocumentsController                   │
│                   (HTTP Layer)                          │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                DocumentManagerService                   │
│              (Business Logic Layer)                     │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
┌─────────────▼───────────────┐ ┌─────────▼───────────────┐
│     IDocumentValidator      │ │     IDocumentStorage    │
│    (Validation Interface)   │ │   (Storage Interface)   │
└─────────────┬───────────────┘ └─────────┬───────────────┘
              │                           │
┌─────────────▼───────────────┐ ┌─────────▼───────────────┐
│  DocumentValidatorService   │ │ S3DocumentStorageService│
│     (Validation Impl)       │ │    (S3 Storage Impl)    │
└─────────────────────────────┘ └─────────────────────────┘
```

---

## Extension Examples

### Adding Azure Storage

```typescript
@Injectable()
export class AzureDocumentStorageService implements IDocumentStorage {
  async upload(file: Buffer, metadata: DocumentMetadata): Promise<DocumentUploadResult> {
    // Azure Blob Storage implementation
  }
  
  async download(key: string): Promise<DocumentDownloadResult> {
    // Azure Blob Storage implementation
  }
  
  // ... other methods
}

// In module
{
  provide: IDocumentStorage,
  useClass: AzureDocumentStorageService, // Switch to Azure
}
```

### Adding Virus Scanning

```typescript
@Injectable()
export class VirusScanningValidatorService implements IDocumentValidator {
  constructor(
    private baseValidator: DocumentValidatorService,
    private virusScanner: VirusScannerService,
  ) {}

  async validate(input: DocumentValidationInput): Promise<DocumentValidationResult> {
    // First run base validation
    const baseResult = await this.baseValidator.validate(input);
    
    if (!baseResult.isValid) return baseResult;
    
    // Then scan for viruses
    if (input.buffer) {
      const isSafe = await this.virusScanner.scan(input.buffer);
      if (!isSafe) {
        baseResult.errors.push('File contains malware');
        baseResult.isValid = false;
      }
    }
    
    return baseResult;
  }
}
```

---

## Testing

### Unit Tests

```typescript
describe('DocumentManagerService', () => {
  let service: DocumentManagerService;
  let mockStorage: jest.Mocked<IDocumentStorage>;
  let mockValidator: jest.Mocked<IDocumentValidator>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockValidator = createMockValidator();
    service = new DocumentManagerService(mockStorage, mockValidator);
  });

  it('should upload document successfully', async () => {
    // Test implementation
  });
});
```

### Integration Tests

```typescript
describe('Documents API', () => {
  it('should upload and download document', async () => {
    const file = Buffer.from('test content');
    
    // Upload
    const uploadResult = await request(app)
      .post('/api/documents/upload')
      .attach('file', file, 'test.txt')
      .expect(201);
    
    // Download
    const downloadResult = await request(app)
      .get(`/api/documents/${uploadResult.body.key}/download`)
      .expect(200);
    
    expect(downloadResult.body).toEqual(file);
  });
});
```

---

## Benefits

### SOLID Compliance
✅ **Single Responsibility**: Each class has one reason to change  
✅ **Open/Closed**: Extensible without modification  
✅ **Liskov Substitution**: Implementations are interchangeable  
✅ **Interface Segregation**: Focused, cohesive interfaces  
✅ **Dependency Inversion**: Depends on abstractions  

### Features
✅ **Comprehensive validation**: File type, size, content, malware scanning  
✅ **Flexible storage**: Easy to switch between S3, Azure, GCP  
✅ **Pre-signed URLs**: Direct client-to-storage uploads/downloads  
✅ **Metadata support**: Tags, descriptions, categories  
✅ **Error handling**: Graceful error handling with detailed messages  
✅ **Security**: File sanitization, blocked extensions, content validation  
✅ **Monitoring**: Comprehensive logging and health checks  

### Scalability
✅ **Stateless**: No server-side file storage  
✅ **Direct uploads**: Reduces server load  
✅ **Caching**: Pre-signed URLs can be cached  
✅ **Extensible**: Easy to add new features and storage providers  

---

## Import into App Module

```typescript
// app.module.ts
import { DocumentsModule } from './modules/documents/documents.module';

@Module({
  imports: [
    // ... other modules
    DocumentsModule,
  ],
})
export class AppModule {}
```

**Your SOLID-compliant document management API is ready to use!** 🚀