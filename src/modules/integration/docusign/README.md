# DocuSign Integration - Development Guide

## Overview

This module integrates DocuSign eSignature REST API into the NestJS-based Tenant Real Estate Management System. It enables electronic signature workflows for lease documents, allowing property managers to send lease PDFs to tenants for signature via DocuSign, receive webhook notifications upon completion, and automatically update lease status with signed documents.

## Table of Contents

- [Environment Setup](#environment-setup)
- [Local Development with ngrok](#local-development-with-ngrok)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Environment Setup

### Required Environment Variables

The following environment variables must be configured in your `.env` file:

```bash
# DocuSign Integration
DOCUSIGN_INTEGRATION_KEY=your_docusign_integration_key
DOCUSIGN_USER_ID=your_docusign_user_id
DOCUSIGN_ACCOUNT_ID=your_docusign_account_id
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nyour_private_key_here\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=your_webhook_secret

# Storage strategy for signed documents: 's3' or 'database' (default: database)
STORAGE_STRATEGY=s3
```

### Getting DocuSign Credentials

1. **Create a DocuSign Developer Account**
   - Go to https://developers.docusign.com/
   - Sign up for a free developer account
   - You'll get access to the demo environment

2. **Create an Integration Key**
   - Log in to DocuSign Admin (https://admindemo.docusign.com/)
   - Navigate to Settings → Integrations → Apps and Keys
   - Click "Add App and Integration Key"
   - Note the **Integration Key** (this is your `DOCUSIGN_INTEGRATION_KEY`)

3. **Generate RSA Key Pair**
   - In the same Apps and Keys section, click "Add RSA Keypair"
   - Download the private key file
   - Copy the private key content to `DOCUSIGN_PRIVATE_KEY` (keep the newlines as `\n`)

4. **Get User ID and Account ID**
   - **User ID**: Found in your DocuSign profile (Settings → My Account → API and Keys)
   - **Account ID**: Found in the same location or in the URL when logged into DocuSign

5. **Grant Consent for JWT**
   - Construct the consent URL:
     ```
     https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri=https://localhost
     ```
   - Replace `{INTEGRATION_KEY}` with your integration key
   - Open the URL in a browser and grant consent
   - This is a one-time step required for JWT authentication

6. **Generate Webhook Secret**
   - Generate a random secret for HMAC validation:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Use this value for `DOCUSIGN_WEBHOOK_SECRET`

### Example .env.development File

Create a `.env.development` file for local development:

```bash
# =============================
# Node / App Config
# =============================
NODE_ENV=development
PORT=4010
LOG_LEVEL=debug
FRONTEND_URL=http://localhost:3002

# =============================
# MongoDB
# =============================
MONGO_URI=mongodb://admin:secret@localhost:27017?authSource=admin
MONGO_DB_NAME=melonleaf_gfi_dev

# =============================
# JWT / Auth
# =============================
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRES_IN=24h
RESET_TOKEN_EXPIRY_MINUTES=15
BCRYPT_SALT_ROUNDS=10

# =============================
# Redis / Queue
# =============================
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# =============================
# AWS S3 (File Storage)
# =============================
AWS_ACCESS_KEY_ID=your_dev_access_key
AWS_SECRET_ACCESS_KEY=your_dev_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=melonleaf-dev-bucket

# =============================
# DocuSign Integration (Demo Environment)
# =============================
DOCUSIGN_INTEGRATION_KEY=a1b2c3d4-e5f6-7890-abcd-ef1234567890
DOCUSIGN_USER_ID=12345678-abcd-1234-abcd-1234567890ab
DOCUSIGN_ACCOUNT_ID=87654321
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...(your key here)...\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Storage strategy: 'database' for local dev (no S3 needed)
STORAGE_STRATEGY=database

# =============================
# Mail / SendGrid SMTP
# =============================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=dev@example.com
SMTP_PASS=your_app_password
MAIL_FROM="MelonLeaf Dev <dev@example.com>"
```

---

## Local Development with ngrok

To test DocuSign webhooks locally, you need to expose your local server to the internet using ngrok.

### Step 1: Install ngrok

```bash
# Using npm
npm install -g ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Start Your NestJS Application

```bash
npm run start:dev
```

Your application should be running on `http://localhost:4010` (or your configured PORT).

### Step 3: Start ngrok Tunnel

```bash
ngrok http 4010
```

You'll see output like:

```
ngrok by @inconshreveable

Session Status                online
Account                       your-account (Plan: Free)
Version                       2.3.40
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123def456.ngrok.io -> http://localhost:4010
```

Note the `https://` forwarding URL (e.g., `https://abc123def456.ngrok.io`).

### Step 4: Configure DocuSign Connect Webhook

1. Log in to DocuSign Admin (https://admindemo.docusign.com/)
2. Navigate to Settings → Connect → Add Configuration
3. Configure the webhook:
   - **Name**: Local Development Webhook
   - **URL**: `https://abc123def456.ngrok.io/webhooks/docusign`
   - **Events**: Select "Envelope Sent" and "Envelope Completed"
   - **Include HMAC Signature**: Enable
   - **HMAC Secret**: Use the value from `DOCUSIGN_WEBHOOK_SECRET`
4. Save the configuration

### Step 5: Test Webhook Delivery

1. Send a test envelope using the API or DocuSign UI
2. Monitor your application logs for webhook events
3. Use ngrok's web interface (http://127.0.0.1:4040) to inspect webhook requests

### ngrok Tips

- **Persistent URLs**: Free ngrok URLs change on restart. Consider upgrading to a paid plan for persistent URLs.
- **Request Inspector**: Access http://127.0.0.1:4040 to see all HTTP requests, including webhook payloads.
- **Replay Requests**: Use the ngrok inspector to replay webhook requests for debugging.

---

## API Endpoints

### 1. Send Lease for Signature

Sends a lease document to DocuSign for tenant signature.

**Endpoint**: `POST /leases/:id/send-for-signature`

**Authentication**: Required (JWT Bearer token)

**Path Parameters**:
- `id` (string, required): The lease ID

**Request Body**:
```json
{
  "recipientEmail": "tenant@example.com",  // Optional: Override tenant email
  "signaturePosition": {                    // Optional: Custom signature position
    "pageNumber": 1,
    "xPosition": 100,
    "yPosition": 200
  }
}
```

**Success Response** (200 OK):
```json
{
  "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "sent",
  "statusDateTime": "2024-01-15T10:30:00Z",
  "uri": "/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request body or parameters
- `404 Not Found`: Lease not found
- `500 Internal Server Error`: DocuSign API error or envelope creation failure

**Example cURL**:
```bash
curl -X POST http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "tenant@example.com"
  }'
```

**Example with Postman**:
1. Method: POST
2. URL: `http://localhost:4010/leases/507f1f77bcf86cd799439011/send-for-signature`
3. Headers:
   - `Authorization`: `Bearer YOUR_JWT_TOKEN`
   - `Content-Type`: `application/json`
4. Body (raw JSON):
   ```json
   {
     "recipientEmail": "tenant@example.com"
   }
   ```

### 2. DocuSign Webhook Handler

Receives webhook notifications from DocuSign when envelope status changes.

**Endpoint**: `POST /webhooks/docusign`

**Authentication**: None (validated via HMAC signature)

**Headers**:
- `X-DocuSign-Signature-1` (required): HMAC-SHA256 signature for request validation

**Request Body**: DocuSign webhook payload (varies by event type)

**Success Response** (200 OK): Empty response

**Error Responses**:
- `401 Unauthorized`: Invalid HMAC signature

**Note**: This endpoint is called by DocuSign, not by your application. You don't need to call it manually.

---

## Testing

### Unit Tests

Run unit tests for the DocuSign module:

```bash
# Run all tests
npm test

# Run DocuSign-specific tests
npm test -- docusign

# Run with coverage
npm test -- --coverage docusign
```

### Property-Based Tests

Run property-based tests to verify correctness properties:

```bash
# Run all property tests
npm test -- --run

# Run specific property test file
npm test -- docusign.service.spec.ts --run
```

### Integration Tests

Test the full flow with mocked DocuSign API:

```bash
npm test -- docusign.controller.spec.ts --run
```

### Manual End-to-End Testing

1. **Setup**: Ensure ngrok is running and DocuSign webhook is configured
2. **Create a test lease** in your database with a PDF document
3. **Send for signature**:
   ```bash
   curl -X POST http://localhost:4010/leases/{LEASE_ID}/send-for-signature \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json"
   ```
4. **Check DocuSign**: Log in to DocuSign demo and verify the envelope was created
5. **Sign the document**: Complete the signature in DocuSign
6. **Verify webhook**: Check your application logs for webhook processing
7. **Verify lease update**: Query the lease and verify status is "SIGNED"

---

## Troubleshooting

### Authentication Issues

#### Problem: "Authentication failed: invalid_grant"

**Cause**: JWT consent not granted or expired.

**Solution**:
1. Construct the consent URL:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri=https://localhost
   ```
2. Open in browser and grant consent
3. Restart your application

#### Problem: "Invalid private key format"

**Cause**: Private key not properly formatted in environment variable.

**Solution**:
- Ensure the private key includes `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`
- Use `\n` for newlines in the `.env` file:
  ```
  DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB...\n-----END RSA PRIVATE KEY-----"
  ```
- Alternatively, use multiline format in `.env`:
  ```
  DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
  MIIEpAIBAAKCAQEA...
  -----END RSA PRIVATE KEY-----"
  ```

#### Problem: "Token expired" errors

**Cause**: Cached token expired but not refreshed.

**Solution**: The service automatically refreshes tokens. If issues persist:
1. Check system clock is synchronized
2. Verify `JWT_EXPIRES_IN` is set correctly
3. Clear any manual token caching

### Envelope Creation Issues

#### Problem: "Lease not found"

**Cause**: Invalid lease ID or lease doesn't exist.

**Solution**:
- Verify the lease ID is correct
- Check the lease exists in the database
- Ensure the lease has an associated PDF document

#### Problem: "Missing PDF document"

**Cause**: Lease doesn't have an associated PDF file.

**Solution**:
- Ensure the lease has a PDF uploaded
- Check the `documentUrl` or `pdfPath` field in the Lease entity
- Verify file storage (S3 or database) is accessible

#### Problem: "Invalid recipient email"

**Cause**: Tenant email is missing or invalid.

**Solution**:
- Verify the tenant email is set in the Lease entity
- Check email format is valid
- Use `recipientEmail` in request body to override

### Webhook Issues

#### Problem: Webhooks not received

**Cause**: ngrok tunnel not running or DocuSign Connect not configured.

**Solution**:
1. Verify ngrok is running: `ngrok http 4010`
2. Check ngrok URL is correct in DocuSign Connect
3. Verify webhook endpoint is accessible: `curl https://your-ngrok-url.ngrok.io/webhooks/docusign`
4. Check DocuSign Connect configuration is enabled

#### Problem: "401 Unauthorized" on webhook

**Cause**: HMAC signature validation failed.

**Solution**:
- Verify `DOCUSIGN_WEBHOOK_SECRET` matches the secret in DocuSign Connect
- Check the secret is configured correctly in DocuSign Admin
- Ensure raw request body is preserved (see `main.ts` configuration)

#### Problem: Webhook received but lease not updated

**Cause**: Processing error after signature validation.

**Solution**:
1. Check application logs for errors
2. Verify envelope ID is stored in the lease
3. Check document retrieval from DocuSign API
4. Verify storage (S3 or database) is accessible
5. Use ngrok inspector to view webhook payload

### Storage Issues

#### Problem: "Failed to store signed document"

**Cause**: S3 or database storage error.

**Solution**:
- **For S3**: Verify AWS credentials and bucket permissions
- **For database**: Check MongoDB connection and storage limits
- Check `STORAGE_STRATEGY` environment variable
- Review application logs for specific error details

#### Problem: "Storage retry exhausted"

**Cause**: Storage failed after 3 retry attempts.

**Solution**:
1. Check storage service availability
2. Verify network connectivity
3. Check storage quotas and limits
4. Review exponential backoff logs for failure patterns

### Configuration Issues

#### Problem: "Missing required environment variable"

**Cause**: Required DocuSign configuration not set.

**Solution**:
- Verify all required variables are in `.env` file:
  - `DOCUSIGN_INTEGRATION_KEY`
  - `DOCUSIGN_USER_ID`
  - `DOCUSIGN_ACCOUNT_ID`
  - `DOCUSIGN_PRIVATE_KEY`
  - `DOCUSIGN_BASE_PATH`
  - `DOCUSIGN_WEBHOOK_SECRET`
- Restart the application after updating `.env`

#### Problem: Application won't start

**Cause**: Configuration validation failed.

**Solution**:
1. Check application logs for specific error
2. Verify all environment variables are set
3. Validate private key format
4. Ensure no typos in variable names

### Debugging Tips

1. **Enable Debug Logging**:
   ```bash
   LOG_LEVEL=debug npm run start:dev
   ```

2. **Use ngrok Inspector**:
   - Access http://127.0.0.1:4040
   - View all webhook requests and responses
   - Replay requests for debugging

3. **Check DocuSign Logs**:
   - Log in to DocuSign Admin
   - Navigate to Settings → Connect → Your Configuration
   - View webhook delivery logs and failures

4. **Test HMAC Validation**:
   ```typescript
   // In your test file
   const crypto = require('crypto');
   const secret = 'your_webhook_secret';
   const body = JSON.stringify(webhookPayload);
   const signature = crypto.createHmac('sha256', secret).update(body).digest('base64');
   console.log('Expected signature:', signature);
   ```

5. **Verify Token Generation**:
   ```bash
   # Test JWT generation manually
   node -e "
   const jwt = require('jsonwebtoken');
   const fs = require('fs');
   const privateKey = fs.readFileSync('private.key');
   const token = jwt.sign({
     iss: 'YOUR_INTEGRATION_KEY',
     sub: 'YOUR_USER_ID',
     aud: 'account-d.docusign.com',
     iat: Math.floor(Date.now() / 1000),
     exp: Math.floor(Date.now() / 1000) + 3600,
     scope: 'signature impersonation'
   }, privateKey, { algorithm: 'RS256' });
   console.log(token);
   "
   ```

### Common Error Messages

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `CONSENT_REQUIRED` | JWT consent not granted | Grant consent via OAuth URL |
| `INVALID_TOKEN_FORMAT` | Malformed JWT | Check JWT generation logic |
| `USER_AUTHENTICATION_FAILED` | Invalid credentials | Verify integration key and user ID |
| `ENVELOPE_DOES_NOT_EXIST` | Invalid envelope ID | Check envelope ID in request |
| `ACCOUNT_LACKS_PERMISSIONS` | Insufficient DocuSign permissions | Check account permissions in DocuSign Admin |
| `HMAC_VALIDATION_FAILED` | Invalid webhook signature | Verify webhook secret matches |

### Getting Help

- **DocuSign Developer Support**: https://developers.docusign.com/support
- **DocuSign API Reference**: https://developers.docusign.com/docs/esign-rest-api/reference
- **NestJS Documentation**: https://docs.nestjs.com
- **Project Issues**: Check the project's issue tracker

---

## Additional Resources

- [DocuSign Developer Center](https://developers.docusign.com/)
- [DocuSign eSignature REST API Reference](https://developers.docusign.com/docs/esign-rest-api/reference)
- [DocuSign JWT Authentication Guide](https://developers.docusign.com/platform/auth/jwt/)
- [DocuSign Connect Webhooks](https://developers.docusign.com/platform/webhooks/)
- [ngrok Documentation](https://ngrok.com/docs)
