# DocuSign Integration - Quick Start

## Current Issue

Your application is failing to start with this error:
```
Missing required DocuSign environment variables: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY, DOCUSIGN_BASE_PATH, DOCUSIGN_WEBHOOK_SECRET
```

## Quick Fix (5 minutes)

### Option 1: Use Placeholder Values (For Development)

If you don't have DocuSign credentials yet, add these placeholder values to your `.env` file to allow the app to start:

```env
DOCUSIGN_INTEGRATION_KEY=placeholder-integration-key
DOCUSIGN_USER_ID=placeholder-user-id
DOCUSIGN_ACCOUNT_ID=placeholder-account-id
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nplaceholder\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=placeholder-webhook-secret-change-this-later
STORAGE_STRATEGY=database
```

**Note:** The DocuSign features won't work with placeholder values, but your app will start.

### Option 2: Get Real Credentials (30-45 minutes)

Follow the complete setup guide: [DOCUSIGN_SETUP_GUIDE.md](./DOCUSIGN_SETUP_GUIDE.md)

---

## What's Already Done

✅ DocuSign integration code is implemented  
✅ API endpoints are ready (`POST /leases/:id/send-for-signature`)  
✅ Webhook handling is configured  
✅ Frontend documentation is available  
✅ Environment variables are added to `.env` file  

---

## What You Need to Do

### Immediate (to start the app):

1. **Open your `.env` file**
2. **Add the DocuSign environment variables** (see Option 1 or Option 2 above)
3. **Restart your application**

### Before Using DocuSign Features:

1. **Create a DocuSign Developer Account**
   - Go to https://developers.docusign.com/
   - Sign up for free

2. **Get Your Credentials**
   - Integration Key
   - User ID
   - Account ID
   - RSA Private Key
   - Generate Webhook Secret

3. **Update `.env` with Real Values**

4. **Grant Consent** (one-time setup)

5. **Configure Webhooks** (optional, for production)

---

## Step-by-Step Instructions

### 1. Generate Webhook Secret

Run this command:
```bash
node scripts/generate-webhook-secret.js
```

Copy the output and add it to your `.env` file.

### 2. Get DocuSign Credentials

Follow the detailed guide: [DOCUSIGN_SETUP_GUIDE.md](./DOCUSIGN_SETUP_GUIDE.md)

Key steps:
- Create app in DocuSign Admin Console
- Generate RSA key pair
- Get Integration Key, User ID, and Account ID
- Grant consent for JWT authentication

### 3. Update .env File

Your `.env` file should have these variables:

```env
# DocuSign Integration
DOCUSIGN_INTEGRATION_KEY=your_actual_integration_key
DOCUSIGN_USER_ID=your_actual_user_id
DOCUSIGN_ACCOUNT_ID=your_actual_account_id
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nyour_actual_private_key\n-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_PATH=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_SECRET=your_generated_webhook_secret
STORAGE_STRATEGY=database
```

### 4. Test the Integration

Start your app:
```bash
npm run start:dev
```

Test the endpoint:
```bash
curl -X POST http://localhost:4020/leases/{lease_id}/send-for-signature \
  -H "Authorization: Bearer {your_jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{"leaseId": "{lease_id}"}'
```

---

## Available Documentation

| Document | Purpose |
|----------|---------|
| [DOCUSIGN_SETUP_GUIDE.md](./DOCUSIGN_SETUP_GUIDE.md) | Complete setup instructions with screenshots |
| [FRONTEND_API_DOCUMENTATION.md](./FRONTEND_API_DOCUMENTATION.md) | API documentation for frontend developers |
| [API_EXAMPLES.md](./src/modules/integration/docusign/API_EXAMPLES.md) | Code examples and integration patterns |

---

## Troubleshooting

### App won't start

**Error:** "Missing required DocuSign environment variables"

**Solution:** Add all 6 required variables to your `.env` file (use placeholders if needed)

### "consent_required" error

**Solution:** Grant consent using the URL in the setup guide

### "Invalid private key" error

**Solution:** 
- Ensure the key includes `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`
- Use `\n` for line breaks in .env files
- Wrap the key in double quotes

### Webhooks not working

**Solution:**
- Use ngrok for local development: `ngrok http 4020`
- Configure the ngrok URL in DocuSign Connect
- Ensure HMAC validation is enabled

---

## Production Checklist

Before deploying to production:

- [ ] Get production DocuSign credentials (requires paid account)
- [ ] Update `DOCUSIGN_BASE_PATH` to production URL
- [ ] Configure production webhook URL
- [ ] Set `STORAGE_STRATEGY=s3` (if using S3)
- [ ] Store credentials in secure secret manager
- [ ] Enable IP allowlisting in DocuSign
- [ ] Set up monitoring and alerting
- [ ] Test with real lease documents
- [ ] Document rollback procedures

---

## Need Help?

1. **Setup Issues:** See [DOCUSIGN_SETUP_GUIDE.md](./DOCUSIGN_SETUP_GUIDE.md)
2. **API Usage:** See [FRONTEND_API_DOCUMENTATION.md](./FRONTEND_API_DOCUMENTATION.md)
3. **DocuSign Support:** https://support.docusign.com/
4. **Developer Forum:** https://community.docusign.com/

---

## Summary

**To fix the immediate error and start your app:**

1. Add the 6 required environment variables to `.env` (use placeholders if needed)
2. Restart the application
3. Follow the setup guide to get real credentials when ready

**Current Status:**
- ❌ App won't start (missing environment variables)
- ✅ Code is ready
- ✅ Documentation is available
- ⏳ Waiting for DocuSign credentials

**Next Action:**
Add environment variables to `.env` file → Restart app → Get DocuSign credentials → Test integration
