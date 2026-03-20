# DocuSign Integration - Quick Start Guide

This guide will help you get the DocuSign integration up and running in under 10 minutes.

## Prerequisites

- Node.js and npm installed
- MongoDB running locally
- DocuSign Developer Account (free at https://developers.docusign.com/)

## Step 1: Get DocuSign Credentials (5 minutes)

1. **Sign up for DocuSign Developer Account**
   - Go to https://developers.docusign.com/
   - Click "Get Started for Free"
   - Complete registration

2. **Create Integration Key**
   - Log in to https://admindemo.docusign.com/
   - Go to Settings → Integrations → Apps and Keys
   - Click "Add App and Integration Key"
   - Copy the Integration Key

3. **Generate RSA Key Pair**
   - In Apps and Keys, click "Add RSA Keypair"
   - Download the private key file
   - Open the file and copy the entire content

4. **Get User ID and Account ID**
   - In DocuSign Admin, go to Settings → My Account → API and Keys
   - Copy your User ID and Account ID

5. **Grant JWT Consent** (one-time)
   - Replace `{YOUR_INTEGRATION_KEY}` in this URL:
     ```
     https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={YOUR_INTEGRATION_KEY}&redirect_uri=https://localhost
     ```
   - Open the URL in your browser
   - Click "Allow Access"

## Step 2: Configure Environment Variables (2 minutes)

1. Copy `.env.development` to `.env`:
   ```bash
   cp .env.development .env
   ```

2. Update DocuSign credentials in `.env`:
   ```bash
   DOCUSIGN_INTEGRATION_KEY=your_integration_key_here
   DOCUSIGN_USER_ID=your_user_id_here
   DOCUSIGN_ACCOUNT_ID=your_account_id_here
   DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nyour_private_key_content\n-----END RSA PRIVATE KEY-----"
   DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
   DOCUSIGN_WEBHOOK_SECRET=generate_random_secret_here
   STORAGE_STRATEGY=database
   ```

3. Generate webhook secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output to `DOCUSIGN_WEBHOOK_SECRET`

## Step 3: Start the Application (1 minute)

```bash
# Install dependencies (if not already done)
npm install

# Start the application
npm run start:dev
```

The application should start on http://localhost:4010

## Step 4: Test Authentication (1 minute)

The application will automatically authenticate with DocuSign on startup. Check the logs for:

```
[DocuSignService] Successfully authenticated with DocuSign
```

If you see authentication errors, review the [Troubleshooting](#troubleshooting) section.

## Step 5: Setup ngrok for Webhooks (2 minutes)

1. **Install ngrok** (if not already installed):
   ```bash
   npm install -g ngrok
   ```

2. **Start ngrok tunnel**:
   ```bash
   ngrok http 4010
   ```

3. **Copy the HTTPS URL** from ngrok output:
   ```
   Forwarding  https://abc123.ngrok.io -> http://localhost:4010
   ```

4. **Configure DocuSign Connect**:
   - Go to https://admindemo.docusign.com/
   - Navigate to Settings → Connect → Add Configuration
   - Set URL to: `https://abc123.ngrok.io/webhooks/docusign`
   - Enable "Include HMAC Signature"
   - Set HMAC Secret to your `DOCUSIGN_WEBHOOK_SECRET` value
   - Select events: "Envelope Sent" and "Envelope Completed"
   - Save

## Step 6: Test the Integration (2 minutes)

### Option A: Using cURL

```bash
# Replace {LEASE_ID} with an actual lease ID from your database
# Replace {JWT_TOKEN} with a valid JWT token from your auth system

curl -X POST http://localhost:4010/leases/{LEASE_ID}/send-for-signature \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "test@example.com"
  }'
```

### Option B: Using Postman

1. Create a new POST request
2. URL: `http://localhost:4010/leases/{LEASE_ID}/send-for-signature`
3. Headers:
   - `Authorization`: `Bearer {JWT_TOKEN}`
   - `Content-Type`: `application/json`
4. Body (raw JSON):
   ```json
   {
     "recipientEmail": "test@example.com"
   }
   ```
5. Send the request

### Expected Response

```json
{
  "envelopeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "sent",
  "statusDateTime": "2024-01-15T10:30:00Z",
  "uri": "/envelopes/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## Step 7: Verify Webhook Delivery

1. **Sign the document** in DocuSign (check the recipient's email)
2. **Check application logs** for webhook processing:
   ```
   [DocuSignController] Webhook received: envelope.completed
   [DocuSignService] Processing completed envelope: a1b2c3d4-e5f6-7890-abcd-ef1234567890
   [DocuSignService] Lease status updated to SIGNED
   ```
3. **Verify lease status** in your database - it should be "SIGNED"

## Troubleshooting

### Authentication Failed

**Error**: `Authentication failed: invalid_grant`

**Solution**: Grant JWT consent using the URL from Step 1.5

### Webhook Not Received

**Error**: No webhook logs in application

**Solution**:
1. Verify ngrok is running
2. Check DocuSign Connect configuration URL matches ngrok URL
3. View ngrok inspector at http://127.0.0.1:4040

### HMAC Validation Failed

**Error**: `401 Unauthorized` on webhook

**Solution**:
1. Verify `DOCUSIGN_WEBHOOK_SECRET` in `.env` matches DocuSign Connect configuration
2. Restart the application after changing the secret

### Lease Not Found

**Error**: `404 Not Found` when sending for signature

**Solution**:
1. Verify the lease ID exists in your database
2. Ensure the lease has an associated PDF document

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Review the [API Endpoints](./README.md#api-endpoints) section
- Check out the [Testing](./README.md#testing) guide
- Explore the [Troubleshooting](./README.md#troubleshooting) section for common issues

## Need Help?

- **DocuSign Developer Support**: https://developers.docusign.com/support
- **DocuSign API Reference**: https://developers.docusign.com/docs/esign-rest-api/reference
- **Project Documentation**: See [README.md](./README.md)
