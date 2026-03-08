# LOI Document Upload & Processing Flow

## Overview

This document describes the complete flow for uploading LOI (Letter of Intent) documents, processing them with Google Document AI, and extracting deal terms into the lead's `current_negotiation` fields.

## Architecture

### Services Used
- **MediaService**: S3 file upload/download operations
- **DocumentAiService**: Google Document AI integration for PDF processing
- **LeadsQueue (BullMQ)**: Async job queue for background processing
- **LeadsProcessor**: Worker that processes queued documents
- **LeadsService**: Business logic for lead management

### Design Principles
- **SOLID**: Single Responsibility, reuses existing services
- **DRY**: No code duplication, leverages existing infrastructure
- **Async Processing**: Non-blocking document processing

---

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOI UPLOAD & PROCESSING FLOW                  │
└─────────────────────────────────────────────────────────────────┘

STEP 1: GET PRESIGNED UPLOAD URL
   Frontend → POST /leasing/active-leads/:id/loi/upload-url
   ↓
   Backend generates presigned S3 URL
   ↓
   Returns: { key, url, contentType }

STEP 2: UPLOAD PDF TO S3 (Direct Upload)
   Frontend → PUT to presigned URL
   ↓
   File uploaded to: leads/{leadId}/loi/{uuid}.pdf
   ↓
   S3 stores the file

STEP 3: CONFIRM UPLOAD & TRIGGER PROCESSING
   Frontend → POST /leasing/active-leads/:id/loi/confirm
   Body: { key, fileName, fileSize }
   ↓
   Backend updates lead.loiDocumentUrl = key
   ↓
   Queue job for Document AI processing
   ↓
   Returns: { success, processingStatus: 'PENDING' }

STEP 4: ASYNC BACKGROUND PROCESSING
   LeadsProcessor picks up job from queue
   ↓
   Download PDF buffer from S3
   ↓
   Send to Google Document AI
   ↓
   Extract fields with confidence scores
   ↓
   Update lead.current_negotiation fields
   ↓
   Store extraction metadata
```

---

## API Endpoints

### 1. Get Upload URL

**Endpoint**: `POST /leasing/active-leads/:id/loi/upload-url`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response**:
```json
{
  "statusCode": 200,
  "message": "LOI upload URL generated successfully",
  "data": {
    "key": "leads/69ac04f54cdbe36f2f12589b/loi/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "url": "https://your-bucket.s3.amazonaws.com/...",
    "contentType": "application/pdf"
  }
}
```

### 2. Upload to S3 (Direct)

**Endpoint**: `PUT <presigned-url-from-step-1>`

**Headers**:
```
Content-Type: application/pdf
```

**Body**: Binary PDF data

**Response**: 200 OK (from S3)

### 3. Confirm Upload

**Endpoint**: `POST /leasing/active-leads/:id/loi/confirm`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body**:
```json
{
  "key": "leads/69ac04f54cdbe36f2f12589b/loi/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
  "fileName": "LOI-Document.pdf",
  "fileSize": 245678
}
```

**Response**:
```json
{
  "statusCode": 200,
  "message": "LOI document uploaded and queued for processing",
  "data": {
    "key": "leads/69ac04f54cdbe36f2f12589b/loi/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "fileName": "LOI-Document.pdf",
    "fileSize": 245678,
    "uploadedBy": "John Doe",
    "uploadedAt": "2026-03-07T10:30:00.000Z",
    "processingStatus": "PENDING"
  }
}
```

---

## Document AI Processing

### Extracted Fields

The system extracts the following fields from LOI documents and maps them to `current_negotiation`:

| Document AI Field | Lead Field | Type | Description |
|------------------|------------|------|-------------|
| `rent_per_sf` or `base_rent_per_sf` | `current_negotiation.rentPerSf` | number | Rent per square foot |
| `annual_increase` or `ann_inc` or `rent_increase` | `current_negotiation.annInc` | number | Annual rent increase |
| `free_months` or `free_rent_months` | `current_negotiation.freeMonths` | number | Free rent months |
| `lease_term` or `term` | `current_negotiation.term` | string | Lease term (e.g., "5 years") |
| `ti_per_sf` or `tenant_improvement_per_sf` | `current_negotiation.tiPerSf` | number | Tenant improvement per SF |
| `rent_commencement_date` or `rcd` | `current_negotiation.rcd` | string | Rent commencement date |

### Confidence Threshold

- **Minimum Confidence**: 0.85 (85%)
- Fields below this threshold are ignored
- Empty values (empty string, 0, null) are skipped

### Update Logic

- **ONLY** updates `current_negotiation` fields
- **DOES NOT** update `general`, `business`, or `financial` fields
- Only updates fields with non-empty, high-confidence values
- Stores extraction metadata in `loiExtractionData`

---

## Testing with cURL

### Complete Test Flow

```bash
#!/bin/bash

# Configuration
LEAD_ID="69ac04f54cdbe36f2f12589b"
TOKEN="your-jwt-token-here"
API_BASE="http://localhost:4020/api"
PDF_FILE="path/to/your/loi-document.pdf"

echo "=== LOI Upload & Processing Test ==="
echo ""

# STEP 1: Get Upload URL
echo "Step 1: Getting presigned upload URL..."
UPLOAD_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/leasing/active-leads/${LEAD_ID}/loi/upload-url" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Response: ${UPLOAD_RESPONSE}"
echo ""

# Extract key and URL from response
S3_KEY=$(echo $UPLOAD_RESPONSE | jq -r '.data.key')
S3_URL=$(echo $UPLOAD_RESPONSE | jq -r '.data.url')

echo "S3 Key: ${S3_KEY}"
echo "S3 URL: ${S3_URL}"
echo ""

# STEP 2: Upload to S3
echo "Step 2: Uploading PDF to S3..."
curl -X PUT \
  "${S3_URL}" \
  -H "Content-Type: application/pdf" \
  --data-binary "@${PDF_FILE}"

echo ""
echo "Upload complete!"
echo ""

# STEP 3: Confirm Upload
echo "Step 3: Confirming upload and triggering processing..."
FILE_SIZE=$(stat -f%z "${PDF_FILE}" 2>/dev/null || stat -c%s "${PDF_FILE}")

CONFIRM_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/leasing/active-leads/${LEAD_ID}/loi/confirm" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"key\": \"${S3_KEY}\",
    \"fileName\": \"LOI-Document.pdf\",
    \"fileSize\": ${FILE_SIZE}
  }")

echo "Response: ${CONFIRM_RESPONSE}"
echo ""
echo "=== Processing started! Check lead for extracted data. ==="
```

### Individual cURL Commands

#### 1. Get Upload URL
```bash
curl -X POST \
  'http://localhost:4020/api/leasing/active-leads/69ac04f54cdbe36f2f12589b/loi/upload-url' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

#### 2. Upload to S3
```bash
# Use the URL from step 1
curl -X PUT \
  'https://your-bucket.s3.amazonaws.com/leads/69ac04f54cdbe36f2f12589b/loi/uuid.pdf?...' \
  -H 'Content-Type: application/pdf' \
  --data-binary '@/path/to/loi-document.pdf'
```

#### 3. Confirm Upload
```bash
curl -X POST \
  'http://localhost:4020/api/leasing/active-leads/69ac04f54cdbe36f2f12589b/loi/confirm' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "leads/69ac04f54cdbe36f2f12589b/loi/uuid.pdf",
    "fileName": "LOI-Document.pdf",
    "fileSize": 245678
  }'
```

---

## Database Schema

### Lead Schema Updates

```typescript
// Added field to Lead schema
@Prop({ default: '' })
loiDocumentUrl: string;

// Extraction metadata
@Prop({ type: Object })
loiExtractionData: {
  extractedAt: Date;
  confidence: number;
  rawData: any;
  fieldsUpdated: string[];
};
```

### Current Negotiation Schema

```typescript
@Schema({ _id: false })
export class DraftingDetails {
    @Prop({ default: 0 })
    rentPerSf: number;

    @Prop({ default: 0 })
    annInc: number;

    @Prop({ default: 0 })
    freeMonths: number;

    @Prop({ default: '' })
    term: string;

    @Prop({ default: 0 })
    tiPerSf: number;

    @Prop({ default: '' })
    rcd: string;
}
```

---

## Error Handling

### Common Errors

1. **Lead Not Found** (404)
   ```json
   {
     "statusCode": 404,
     "message": "Lead not found"
   }
   ```

2. **Invalid Token** (401)
   ```json
   {
     "statusCode": 401,
     "message": "Unauthorized"
   }
   ```

3. **Processing Failed** (500)
   - Check logs for Document AI errors
   - Verify Google Cloud credentials
   - Ensure PDF is valid and readable

### Monitoring

Check processing status:
```bash
# Get lead details to see loiExtractionData
curl -X GET \
  'http://localhost:4020/api/leasing/active-leads/69ac04f54cdbe36f2f12589b' \
  -H 'Authorization: Bearer <token>'
```

Look for:
- `loiDocumentUrl`: S3 key of uploaded document
- `loiExtractionData`: Extraction results and metadata
- `current_negotiation`: Updated fields

---

## Google Document AI Configuration

### Prerequisites

1. **Google Cloud Project** with Document AI API enabled
2. **Service Account** with Document AI permissions
3. **Credentials JSON** file stored in `credentials/doc-ai.json`
4. **Processor ID** configured in environment variables

### Environment Variables

```env
GOOGLE_APPLICATION_CREDENTIALS=./credentials/doc-ai.json
DOCUMENT_AI_PROJECT_ID=your-project-id
DOCUMENT_AI_LOCATION=us
DOCUMENT_AI_PROCESSOR_ID=your-processor-id
```

### Document AI Request Format

The system sends documents to Document AI using this format:

```typescript
{
  name: `projects/${projectId}/locations/${location}/processors/${processorId}`,
  rawDocument: {
    content: base64EncodedPDF,
    mimeType: 'application/pdf'
  }
}
```

---

## Implementation Details

### Key Methods

1. **`getLoiUploadUrl(leadId)`**
   - Generates presigned S3 upload URL
   - Returns key and URL for frontend

2. **`confirmLoiUpload(leadId, key, fileName, fileSize, userName)`**
   - Updates lead with LOI document URL
   - Queues document for processing
   - Returns confirmation

3. **`updateWithLoiExtraction(leadId, key, result)`**
   - Extracts fields from Document AI result
   - Updates ONLY `current_negotiation` fields
   - Stores extraction metadata
   - Skips empty or low-confidence values

### Queue Job Structure

```typescript
{
  leadId: string,
  fileId: string,
  fileKey: string,
  mimeType: 'application/pdf',
  documentType: 'loi'  // Special flag for LOI processing
}
```

### Processor Logic

```typescript
if (documentType === 'loi') {
  await this.leadsService.updateWithLoiExtraction(leadId, fileKey, extractionResult);
} else {
  await this.leadsService.updateWithExtraction(leadId, fileId, extractionResult);
}
```

---

## Summary

The LOI upload and processing flow:

1. ✅ Uses 3-step upload pattern (get URL → upload → confirm)
2. ✅ Follows SOLID and DRY principles
3. ✅ Reuses existing services (MediaService, DocumentAiService, Queue)
4. ✅ Async processing with BullMQ
5. ✅ Updates ONLY `current_negotiation` fields (NOT `general` fields)
6. ✅ Skips empty or low-confidence values
7. ✅ Stores extraction metadata for audit trail
8. ✅ Proper error handling and logging

The implementation is production-ready and follows best practices for document processing workflows.
