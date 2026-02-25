# DocuSign Integration Setup Guide

This guide will walk you through setting up DocuSign integration for your application.

---

## Prerequisites

- A DocuSign account (Developer or Production)
- Access to DocuSign Admin Console
- Node.js installed on your system

---

## Step 1: Create a DocuSign Developer Account

1. Go to [DocuSign Developer Center](https://developers.docusign.com/)
2. Click "Get Started for Free" or "Sign Up"
3. Complete the registration process
4. Verify your email address

**Note:** The developer account gives you access to the Demo environment for testing.

---

## Step 2: Create an Integration Application

1. Log in to [DocuSign Admin Console](https://admindemo.docusign.com/)
2. Navigate to **Settings** → **Apps and Keys**
3. Click **Add App and Integration Key**
4. Fill in the application details:
   - **App Name**: Your Application Name (e.g., "Property Management System")
   - **Description**: Brief description of your app
5. Click **Create App**

---

## Step 3: Get Your Integration Key

After creating the app, you'll see your **Integration Key** (also called Client ID).

**Copy this value** - you'll need it for `DOCUSIGN_INTEGRATION_KEY`

Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## Step 4: Generate RSA Key Pair

1. In the same **Apps and Keys** page, scroll to your application
2. Click **Actions** → **Edit**
3. Scroll to **Authentication** section
4. Click **Add RSA Keypair**
5. A popup will appear with your **Private Key** and **Public Key**
6. **IMPORTANT**: Copy the **Private Key** immediately - you won't be able to see it again!

**Copy the entire private key** including the header and footer:
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
(multiple lines)
...
-----END RSA PRIVATE KEY-----
```

You'll need this for `DOCUSIGN_PRIVATE_KEY`

---

## Step 5: Get Your User ID

1. In DocuSign Admin Console, click your profile icon (top right)
2. Go to **My Account** → **API and Keys**
3. Find your **User ID** (also called API Username)

**Copy this value** - you'll need it for `DOCUSIGN_USER_ID`

Example: `12345678-abcd-1234-abcd-1234567890ab`

---

## Step 6: Get Your Account ID

Your Account ID can be found in two places:

**Option 1: From URL**
- When logged into DocuSign Admin, look at the URL
- It will contain your account ID: `https://admindemo.docusign.com/accounts/{ACCOUNT_ID}/...`

**Option 2: From API and Keys**
- Go to **Settings** → **API and Keys**
- Your Account ID is displayed at the top

**Copy this value** - you'll need it for `DOCUSIGN_ACCOUNT_ID`

Example: `87654321`

---

## Step 7: Grant Consent for Your Application

Before your application can use JWT authentication, you need to grant consent:

1. Replace the placeholders in this URL with your values:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri={REDIRECT_URI}
   ```

2. For the redirect URI, you can use: `https://developers.docusign.com/platform/auth/consent`

3. Example URL:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&redirect_uri=https://developers.docusign.com/platform/auth/consent
   ```

4. Open this URL in your browser
5. Log in with your DocuSign account
6. Click **Allow Access** to grant consent

**Note:** You only need to do this once per application.

---

## Step 8: Generate Webhook Secret

Generate a secure random string for webhook HMAC validation:

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Using PowerShell:**
```powershell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Using Online Tool:**
- Go to [RandomKeygen](https://randomkeygen.com/)
- Copy a "CodeIgniter Encryption Key" or similar

**Save this value** - you'll need it for `DOCUSIGN_WEBHOOK_SECRET`

Example: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

---

## Step 9: Configure Environment Variables

Open your `.env` file and update the DocuSign section with your values:

```env
# =============================
# DocuSign Integration
# =============================

# Integration Key from Step 3
DOCUSIGN_INTEGRATION_KEY=a1b2c3d4-e5f6-7890-abcd-ef1234567890

# User ID from Step 5
DOCUSIGN_USER_ID=12345678-abcd-1234-abcd-1234567890ab

# Account ID from Step 6
DOCUSIGN_ACCOUNT_ID=87654321

# Private Key from Step 4
# IMPORTANT: Keep the \n characters for line breaks
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n...\n-----END RSA PRIVATE KEY-----"

# Base path - use demo for development, production URL for production
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi

# Webhook secret from Step 8
DOCUSIGN_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Storage strategy
STORAGE_STRATEGY=database
```

### Important Notes for Private Key:

**Option 1: Single Line with \n (Recommended for .env files)**
```env
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

**Option 2: Multiline (if your .env parser supports it)**
```env
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----"
```

---

## Step 10: Configure DocuSign Connect (Webhooks)

To receive webhook notifications when documents are signed:

1. Go to [DocuSign Admin Console](https://admindemo.docusign.com/)
2. Navigate to **Settings** → **Connect** → **Add Configuration**
3. Fill in the configuration:
   - **Name**: Your webhook name (e.g., "Lease Signature Webhook")
   - **URL to Publish**: `https://your-domain.com/webhooks/docusign`
   - **Enable Log**: Check this box
   - **Include HMAC Signature**: Check this box
   - **HMAC Secret**: Enter your `DOCUSIGN_WEBHOOK_SECRET` value

4. Under **Trigger Events**, select:
   - ☑ Envelope Sent
   - ☑ Envelope Delivered
   - ☑ Envelope Completed
   - ☑ Envelope Declined
   - ☑ Envelope Voided

5. Click **Save**

**For Local Development:**
- Use a tool like [ngrok](https://ngrok.com/) to expose your local server
- Run: `ngrok http 4020`
- Use the ngrok URL in the webhook configuration: `https://abc123.ngrok.io/webhooks/docusign`

---

## Step 11: Test Your Configuration

1. Start your application:
   ```bash
   npm run start:dev
   ```

2. Check the logs - you should NOT see any DocuSign configuration errors

3. Test the API endpoint:
   ```bash
   curl -X POST http://localhost:4020/leases/{lease_id}/send-for-signature \
     -H "Authorization: Bearer {your_jwt_token}" \
     -H "Content-Type: application/json" \
     -d '{"leaseId": "{lease_id}"}'
   ```

---

## Troubleshooting

### Error: "Missing required DocuSign environment variables"

**Solution:** Ensure all 6 required variables are set in your `.env` file:
- DOCUSIGN_INTEGRATION_KEY
- DOCUSIGN_USER_ID
- DOCUSIGN_ACCOUNT_ID
- DOCUSIGN_PRIVATE_KEY
- DOCUSIGN_BASE_PATH
- DOCUSIGN_WEBHOOK_SECRET

### Error: "consent_required"

**Solution:** Complete Step 7 (Grant Consent) again. The consent URL must match your Integration Key.

### Error: "Invalid private key"

**Solution:** 
- Ensure the private key includes the header and footer
- Check that line breaks are preserved (use `\n` in .env files)
- Verify you copied the entire key without truncation

### Error: "Account does not exist"

**Solution:**
- Verify your Account ID is correct
- Ensure you're using the correct base path (demo vs production)
- Check that your user has access to the account

### Webhooks not working

**Solution:**
- Verify the webhook URL is publicly accessible
- Check that HMAC signature validation is enabled
- Ensure the webhook secret matches your `.env` file
- Check DocuSign Connect logs for delivery failures

---

## Environment-Specific Configuration

### Development Environment

```env
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
STORAGE_STRATEGY=database
```

### Production Environment

```env
DOCUSIGN_BASE_PATH=https://www.docusign.net/restapi
STORAGE_STRATEGY=s3
```

**Note:** Production requires a paid DocuSign account and production API credentials.

---

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use different credentials** for development and production
3. **Rotate webhook secrets** periodically
4. **Store private keys securely** (use secret management services in production)
5. **Limit API permissions** to only what's needed
6. **Monitor API usage** in DocuSign Admin Console
7. **Enable IP allowlisting** if possible

---

## Quick Reference

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DOCUSIGN_INTEGRATION_KEY` | Application Integration Key | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `DOCUSIGN_USER_ID` | API User ID | `12345678-abcd-1234-abcd-1234567890ab` |
| `DOCUSIGN_ACCOUNT_ID` | DocuSign Account ID | `87654321` |
| `DOCUSIGN_PRIVATE_KEY` | RSA Private Key | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `DOCUSIGN_BASE_PATH` | API Base URL | `https://demo.docusign.net/restapi` |
| `DOCUSIGN_WEBHOOK_SECRET` | HMAC Secret for Webhooks | `a1b2c3d4e5f6...` |

### Useful Links

- [DocuSign Developer Center](https://developers.docusign.com/)
- [DocuSign Admin Console (Demo)](https://admindemo.docusign.com/)
- [DocuSign Admin Console (Production)](https://admin.docusign.com/)
- [DocuSign API Documentation](https://developers.docusign.com/docs/esign-rest-api/)
- [JWT Authentication Guide](https://developers.docusign.com/platform/auth/jwt/)
- [Webhook/Connect Guide](https://developers.docusign.com/platform/webhooks/)

---

## Next Steps

After completing the setup:

1. Review the [Frontend API Documentation](./FRONTEND_API_DOCUMENTATION.md)
2. Test the integration with sample lease documents
3. Configure webhook handling for production
4. Set up monitoring and logging
5. Plan for production deployment

---

## Support

If you encounter issues:

1. Check the [DocuSign Support Center](https://support.docusign.com/)
2. Review [DocuSign Developer Forum](https://community.docusign.com/)
3. Check application logs for detailed error messages
4. Contact your DocuSign account manager for production issues

---

## Appendix: Complete .env Example

```env
# =============================
# DocuSign Integration
# =============================
DOCUSIGN_INTEGRATION_KEY=a1b2c3d4-e5f6-7890-abcd-ef1234567890
DOCUSIGN_USER_ID=12345678-abcd-1234-abcd-1234567890ab
DOCUSIGN_ACCOUNT_ID=87654321
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAyourprivatekeyhere...\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
STORAGE_STRATEGY=database
```
