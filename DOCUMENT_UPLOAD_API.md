# Document Upload API

This API allows uploading PDF documents with specific document types. The document type is included in the S3 key path for better organization.

## Document Types

The following document types are supported:

- `courtesy-notice` - Send Courtesy Notice
- `3-day-notice` - Send 3-Day Notice
- `attorney-notice` - Send to Attorney
- `loi` - Send LOI
- `application` - Send App
- `approval-lease-draft` - Send for Approval/Lease Draft
- `renewal-letter` - Send Renewal Letter
- `approval-amendment-draft` - Send for Approval/Amendment Draft
- `lease-draft` - LEASE: Prepare Lease Draft
- `execution` - Send for Execution
- `mri-upload` - Send to MRI

## Endpoints

### 1. Generate Upload URL

**Endpoint:** `POST /api/leasing/active-leads/:id/documents/upload-url`

**Description:** Generates a presigned S3 URL for uploading a PDF document.

**Request Body:**
```json
{
  "documentType": "courtesy-notice",
  "contentType": "application/pdf"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Upload URL generated successfully",
  "data": {
    "key": "leads/LEAD_ID/documents/courtesy-notice/UUID.pdf",
    "url": "https://s3.amazonaws.com/...",
    "documentType": "courtesy-notice"
  }
}
```

**Example cURL:**
```bash
curl -X POST 'http://localhost:4020/api/leasing/active-leads/69820a6e73032ffdaadf1d26/documents/upload-url' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "documentType": "courtesy-notice",
    "contentType": "application/pdf"
  }'
```

### 2. Upload PDF to S3

**Endpoint:** Use the presigned URL from step 1

**Method:** `PUT`

**Headers:**
- `Content-Type: application/pdf`

**Body:** Binary PDF file

**Example cURL:**
```bash
curl -X PUT 'PRESIGNED_URL_FROM_STEP_1' \
  -H 'Content-Type: application/pdf' \
  --data-binary '@/path/to/document.pdf'
```

### 3. Confirm Upload

**Endpoint:** `POST /api/leasing/active-leads/:id/documents/confirm`

**Description:** Confirms the upload and stores document metadata in the lead record.

**Request Body:**
```json
{
  "key": "leads/LEAD_ID/documents/courtesy-notice/UUID.pdf",
  "fileName": "Courtesy Notice - Tenant Name.pdf",
  "documentType": "courtesy-notice"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "message": "Document uploaded successfully",
  "data": {
    "id": "leads/LEAD_ID/documents/courtesy-notice/UUID.pdf",
    "fileName": "Courtesy Notice - Tenant Name.pdf",
    "fileType": "application/pdf",
    "documentType": "courtesy-notice",
    "uploadedBy": "John Doe",
    "uploadedDate": "2024-03-01T10:00:00.000Z",
    "updatedBy": "John Doe",
    "updatedAt": "2024-03-01T10:00:00.000Z"
  }
}
```

**Example cURL:**
```bash
curl -X POST 'http://localhost:4020/api/leasing/active-leads/69820a6e73032ffdaadf1d26/documents/confirm' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "leads/69820a6e73032ffdaadf1d26/documents/courtesy-notice/abc-123.pdf",
    "fileName": "Courtesy Notice - Tenant Name.pdf",
    "documentType": "courtesy-notice"
  }'
```

## Complete Upload Flow

```bash
# Step 1: Generate upload URL
RESPONSE=$(curl -X POST 'http://localhost:4020/api/leasing/active-leads/LEAD_ID/documents/upload-url' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "documentType": "loi",
    "contentType": "application/pdf"
  }')

# Extract URL and key from response
UPLOAD_URL=$(echo $RESPONSE | jq -r '.data.url')
FILE_KEY=$(echo $RESPONSE | jq -r '.data.key')

# Step 2: Upload file to S3
curl -X PUT "$UPLOAD_URL" \
  -H 'Content-Type: application/pdf' \
  --data-binary '@document.pdf'

# Step 3: Confirm upload
curl -X POST 'http://localhost:4020/api/leasing/active-leads/LEAD_ID/documents/confirm' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d "{
    \"key\": \"$FILE_KEY\",
    \"fileName\": \"LOI Document.pdf\",
    \"documentType\": \"loi\"
  }"
```

## S3 Key Structure

Documents are organized in S3 with the following structure:

```
leads/{leadId}/documents/{documentType}/{uuid}.pdf
```

Examples:
- `leads/69820a6e73032ffdaadf1d26/documents/courtesy-notice/abc-123.pdf`
- `leads/69820a6e73032ffdaadf1d26/documents/loi/def-456.pdf`
- `leads/69820a6e73032ffdaadf1d26/documents/execution/ghi-789.pdf`

## Notes

- Only PDF files are allowed (`application/pdf`)
- The document type is validated against the `DocumentType` enum
- Documents are stored in the lead's `files` array with metadata
- Presigned URLs expire after 15 minutes by default
- All endpoints require authentication (except where marked as `@Public()`)
