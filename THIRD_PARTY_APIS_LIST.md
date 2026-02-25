# Third-Party APIs - Complete List

## MRI Software APIs (Property Management System)

**Base URL:** `https://pmx7api.cloud.mrisoftware.com/mriapiservices/api.asp`

### List of MRI APIs:

1. **MRI_S-PMCM_CommercialLeasesLeasByBuildingID**
   - Purpose: Get all commercial leases for a building
   - File: `mri-leases.service.ts`
   - Parameters: BLDGID, $top, $skip, $filter

2. **MRI_S-PMCM_CommercialLeaseAnlsByBuildingID**
   - Purpose: Get lease analysis data
   - File: `mri-analysis.service.ts`
   - Parameters: BLDGID, LEASEID (optional)

3. **MRI_S-PMCM_OpenARByOccupant**
   - Purpose: Get accounts receivable data
   - File: `mri-ar.service.ts`
   - Parameters: MasterOccupantID

4. **MRI_S-PMCM_CurrentDelinquencies**
   - Purpose: Get current delinquencies/charges
   - File: `mri-charges.service.ts`
   - Parameters: LEASEID

5. **MRI_S-PMCM_LeaseEMEAInformation**
   - Purpose: Get EMEA-specific lease information
   - File: `mri-lease-emea.service.ts`
   - Parameters: BLDGID, LEASEID (optional)

6. **MRI_S-PMCM_CommercialLeasesLeasOptsByBuildingID**
   - Purpose: Get lease options
   - File: `mri-options.service.ts`
   - Parameters: BLDGID, LEASEID (optional)

7. **MRI_S-PMRM_ResidentialRenewalOffers**
   - Purpose: Get residential renewal offers
   - File: `mri-renewal-offers.service.ts`
   - Parameters: PROPERTYID

8. **MRI_S-PMCM_VacantSuites**
   - Purpose: Get vacant suites
   - File: `mri-vacant-suites.service.ts`
   - Parameters: BuildingID, AfterDate

9. **RESTful API: /api/applications/Integrations/CM/Leases/Notes/{buildingId}**
   - Purpose: Get lease notes
   - File: `mri-notes.service.ts`
   - Parameters: buildingId (path), LEASEID (query)

---

## DocuSign API (Electronic Signature)

**Base URL:** 
- Demo: `https://demo.docusign.net/restapi`
- Production: `https://www.docusign.net/restapi`

**Authentication:** JWT (OAuth 2.0)

### DocuSign APIs Used:

1. **Create Envelope**
   - Purpose: Send documents for signature
   - Method: POST
   - Endpoint: `/v2.1/accounts/{accountId}/envelopes`

2. **Get Envelope Status**
   - Purpose: Check envelope status
   - Method: GET
   - Endpoint: `/v2.1/accounts/{accountId}/envelopes/{envelopeId}`

3. **Get Signed Document**
   - Purpose: Download signed document
   - Method: GET
   - Endpoint: `/v2.1/accounts/{accountId}/envelopes/{envelopeId}/documents/{documentId}`

4. **Webhook/Connect**
   - Purpose: Receive status updates
   - Method: POST (incoming)
   - Endpoint: `/webhooks/docusign` (your server)

---

## Google Document AI

**Service:** Google Cloud Document AI
**Library:** `@google-cloud/documentai`

### APIs Used:

1. **Process Document**
   - Purpose: Extract text and data from documents
   - Method: processDocument()
   - File: `document-ai.service.ts`

---

## AWS Services

**Library:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

### AWS APIs Used:

1. **S3 PutObject**
   - Purpose: Upload files to S3
   - Service: S3Client
   - File: `media.service.ts`

2. **S3 GetObject**
   - Purpose: Download files from S3
   - Service: S3Client
   - File: `media.service.ts`

3. **S3 GetSignedUrl**
   - Purpose: Generate presigned URLs
   - Service: getSignedUrl
   - File: `media.service.ts`

---

## Email Service (SMTP)

**Provider:** SendGrid / Gmail SMTP
**Configuration:** SMTP settings in .env

### Email APIs:

1. **Send Email**
   - Purpose: Send transactional emails
   - Protocol: SMTP
   - File: `mail.service.ts`
   - Uses: Nodemailer

---

## Summary Table

| Service | # of APIs | Purpose | Authentication |
|---------|-----------|---------|----------------|
| MRI Software | 9 | Property Management | API Key + Credentials |
| DocuSign | 4 | Electronic Signatures | JWT OAuth 2.0 |
| Google Document AI | 1 | Document Processing | Service Account |
| AWS S3 | 3 | File Storage | Access Key + Secret |
| SMTP | 1 | Email Delivery | Username + Password |

---

## Environment Variables Required

### MRI Software
```env
CLIENT_ID=N362999
DATABASE_NAME=GLOBALTRAIN
WEB_SERVICE_USER_ID=GCWSUSER
WEB_SERVICE_USER_PASSWORD=your_password
DEVELOPER_API_KEY=your_api_key
MRI_API_URL=https://pmx7api.cloud.mrisoftware.com/mriapiservices/api.asp
```

### DocuSign
```env
DOCUSIGN_INTEGRATION_KEY=your_integration_key
DOCUSIGN_USER_ID=your_user_id
DOCUSIGN_ACCOUNT_ID=your_account_id
DOCUSIGN_PRIVATE_KEY=your_private_key
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=your_webhook_secret
```

### Google Document AI
```env
GOOGLE_APPLICATION_CREDENTIALS=./credentials/doc-ai.json
GOOGLE_DOCUMENT_AI_PROJECT_ID=doc-ai-486214
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=931beb1c3db77de8
```

### AWS S3
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name
```

### SMTP
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM="Your Name <your_email@gmail.com>"
```

---

## API Rate Limits & Considerations

### MRI Software
- Rate limits may apply (429 errors observed)
- Retry logic implemented in `mri-core.service.ts`
- Some APIs may return 400 errors for certain parameters

### DocuSign
- Demo account: Limited envelopes per month
- Production: Based on plan
- Webhook retries: 3 attempts

### Google Document AI
- Quota limits apply per project
- Pay-per-use pricing

### AWS S3
- No hard rate limits for standard operations
- Costs based on storage and requests

---

## Related Documentation

- [FRONTEND_API_DOCUMENTATION.md](./FRONTEND_API_DOCUMENTATION.md) - Frontend API docs
- [DOCUSIGN_SETUP_GUIDE.md](./DOCUSIGN_SETUP_GUIDE.md) - DocuSign setup
- [src/modules/integration/docusign/API_EXAMPLES.md](./src/modules/integration/docusign/API_EXAMPLES.md) - DocuSign examples

---

**Last Updated:** February 25, 2026
