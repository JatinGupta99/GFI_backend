# DocuSign Integration - Troubleshooting Checklist

Use this checklist to quickly diagnose and resolve common issues with the DocuSign integration.

## Pre-Flight Checklist

Before reporting an issue, verify these basics:

- [ ] All required environment variables are set in `.env`
- [ ] Application starts without configuration errors
- [ ] MongoDB is running and accessible
- [ ] Redis is running (if using queue features)
- [ ] Network connectivity to DocuSign API (https://demo.docusign.net)

## Authentication Issues

### Symptom: "Authentication failed: invalid_grant"

- [ ] JWT consent has been granted (one-time step)
- [ ] Integration Key is correct
- [ ] User ID is correct
- [ ] Private key is properly formatted with `\n` for newlines
- [ ] Using the correct DocuSign environment (demo vs production)

**Quick Fix**:
```bash
# Grant consent (replace {INTEGRATION_KEY} with your actual key)
open "https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri=https://localhost"
```

### Symptom: "Invalid private key format"

- [ ] Private key includes header: `-----BEGIN RSA PRIVATE KEY-----`
- [ ] Private key includes footer: `-----END RSA PRIVATE KEY-----`
- [ ] Newlines are escaped as `\n` in `.env` file
- [ ] No extra spaces or characters in the key
- [ ] Key was generated in DocuSign Admin (not manually created)

**Quick Fix**:
```bash
# Verify key format
echo $DOCUSIGN_PRIVATE_KEY | grep "BEGIN RSA PRIVATE KEY"
```

### Symptom: "Token expired" or frequent re-authentication

- [ ] System clock is synchronized (check with `date`)
- [ ] Token caching is working (check logs for "Reusing cached token")
- [ ] Expiration buffer is set correctly (5 minutes before actual expiration)

## Envelope Creation Issues

### Symptom: "Lease not found" (404)

- [ ] Lease ID is correct and exists in database
- [ ] Lease ID format is valid MongoDB ObjectId
- [ ] Using the correct database (check `MONGO_DB_NAME`)

**Quick Fix**:
```bash
# Verify lease exists in MongoDB
mongo $MONGO_URI --eval "db.leases.findOne({_id: ObjectId('YOUR_LEASE_ID')})"
```

### Symptom: "Missing PDF document"

- [ ] Lease has a PDF file associated
- [ ] PDF file exists in storage (S3 or database)
- [ ] Storage credentials are correct (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
- [ ] S3 bucket exists and is accessible
- [ ] File path/URL in lease entity is correct

**Quick Fix**:
```bash
# For S3 storage
aws s3 ls s3://$AWS_S3_BUCKET/path/to/lease/pdfs/

# For database storage
mongo $MONGO_URI --eval "db.leases.findOne({_id: ObjectId('YOUR_LEASE_ID')}, {pdfData: 1})"
```

### Symptom: "Invalid recipient email"

- [ ] Tenant email is set in lease entity
- [ ] Email format is valid (contains @ and domain)
- [ ] Email is not blacklisted by DocuSign
- [ ] Using `recipientEmail` override if tenant email is missing

**Quick Fix**:
```bash
# Verify tenant email in database
mongo $MONGO_URI --eval "db.leases.findOne({_id: ObjectId('YOUR_LEASE_ID')}, {tenantEmail: 1})"
```

### Symptom: DocuSign API error (500)

- [ ] DocuSign service is operational (check https://status.docusign.com/)
- [ ] Account has sufficient API quota
- [ ] Account has eSignature permissions
- [ ] Using correct account ID
- [ ] Request payload is valid (check logs for full error)

## Webhook Issues

### Symptom: Webhooks not received

- [ ] ngrok is running (`ngrok http 4010`)
- [ ] ngrok URL is correct in DocuSign Connect
- [ ] DocuSign Connect configuration is enabled
- [ ] Webhook endpoint is accessible (test with `curl https://your-ngrok-url.ngrok.io/webhooks/docusign`)
- [ ] Application is running and listening on correct port
- [ ] No firewall blocking incoming requests

**Quick Fix**:
```bash
# Test webhook endpoint
curl -X POST https://your-ngrok-url.ngrok.io/webhooks/docusign \
  -H "Content-Type: application/json" \
  -d '{"test": "payload"}'

# Check ngrok inspector
open http://127.0.0.1:4040
```

### Symptom: "401 Unauthorized" on webhook

- [ ] `DOCUSIGN_WEBHOOK_SECRET` is set in `.env`
- [ ] Webhook secret matches DocuSign Connect configuration
- [ ] HMAC signature is included in request (X-DocuSign-Signature-1 header)
- [ ] Raw request body is preserved (check `main.ts` configuration)
- [ ] No proxy or middleware modifying request body

**Quick Fix**:
```bash
# Verify webhook secret is set
echo $DOCUSIGN_WEBHOOK_SECRET

# Test HMAC computation
node -e "
const crypto = require('crypto');
const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
const body = '{\"test\":\"payload\"}';
const signature = crypto.createHmac('sha256', secret).update(body).digest('base64');
console.log('Expected signature:', signature);
"
```

### Symptom: Webhook received but lease not updated

- [ ] Envelope ID is stored in lease entity
- [ ] Envelope status is "completed" (not "sent" or "delivered")
- [ ] Lease exists in database with matching envelope ID
- [ ] Document retrieval from DocuSign succeeds
- [ ] Storage (S3 or database) is accessible
- [ ] No errors in application logs

**Quick Fix**:
```bash
# Find lease by envelope ID
mongo $MONGO_URI --eval "db.leases.findOne({docusignEnvelopeId: 'YOUR_ENVELOPE_ID'})"

# Check application logs
tail -f logs/combined.log | grep "envelope"
```

## Storage Issues

### Symptom: "Failed to store signed document"

**For S3 Storage**:
- [ ] `STORAGE_STRATEGY=s3` is set
- [ ] AWS credentials are correct
- [ ] S3 bucket exists
- [ ] Bucket has write permissions
- [ ] Bucket region matches `AWS_REGION`
- [ ] No bucket policy blocking uploads

**Quick Fix**:
```bash
# Test S3 upload
aws s3 cp test.txt s3://$AWS_S3_BUCKET/test.txt
aws s3 rm s3://$AWS_S3_BUCKET/test.txt
```

**For Database Storage**:
- [ ] `STORAGE_STRATEGY=database` is set
- [ ] MongoDB has sufficient storage space
- [ ] Document size is under MongoDB limit (16MB)
- [ ] MongoDB connection is stable

**Quick Fix**:
```bash
# Check MongoDB storage
mongo $MONGO_URI --eval "db.stats()"
```

### Symptom: "Storage retry exhausted"

- [ ] Storage service is available
- [ ] Network connectivity is stable
- [ ] No rate limiting or throttling
- [ ] Retry logic is working (check logs for retry attempts)
- [ ] Exponential backoff is configured correctly

## Configuration Issues

### Symptom: "Missing required environment variable"

- [ ] All required variables are in `.env` file:
  - `DOCUSIGN_INTEGRATION_KEY`
  - `DOCUSIGN_USER_ID`
  - `DOCUSIGN_ACCOUNT_ID`
  - `DOCUSIGN_PRIVATE_KEY`
  - `DOCUSIGN_BASE_PATH`
  - `DOCUSIGN_WEBHOOK_SECRET`
- [ ] No typos in variable names
- [ ] `.env` file is in project root
- [ ] Application was restarted after updating `.env`

**Quick Fix**:
```bash
# Verify all variables are set
grep "DOCUSIGN_" .env

# Check if .env is loaded
node -e "require('dotenv').config(); console.log(process.env.DOCUSIGN_INTEGRATION_KEY)"
```

### Symptom: Application won't start

- [ ] No syntax errors in `.env` file
- [ ] All dependencies are installed (`npm install`)
- [ ] Port 4010 is not already in use
- [ ] MongoDB is running
- [ ] No conflicting environment variables

**Quick Fix**:
```bash
# Check port availability
lsof -i :4010

# Verify dependencies
npm list --depth=0

# Check MongoDB connection
mongo $MONGO_URI --eval "db.runCommand({ping: 1})"
```

## Testing Issues

### Symptom: Unit tests failing

- [ ] Test database is configured
- [ ] Mock services are properly configured
- [ ] Test environment variables are set
- [ ] No external dependencies in unit tests

**Quick Fix**:
```bash
# Run tests with verbose output
npm test -- --verbose docusign

# Run specific test file
npm test -- docusign.service.spec.ts
```

### Symptom: Property-based tests failing

- [ ] Test iterations are sufficient (minimum 100)
- [ ] Generators produce valid test data
- [ ] Properties are correctly specified
- [ ] No flaky tests (run multiple times to verify)

**Quick Fix**:
```bash
# Run property tests with more iterations
npm test -- --run docusign.service.spec.ts
```

## Performance Issues

### Symptom: Slow envelope creation

- [ ] Network latency to DocuSign API
- [ ] PDF file size is reasonable (<5MB)
- [ ] Token caching is working
- [ ] No unnecessary API calls

**Quick Fix**:
```bash
# Test API latency
curl -w "@curl-format.txt" -o /dev/null -s https://demo.docusign.net/restapi

# Check PDF file size
ls -lh path/to/lease.pdf
```

### Symptom: Webhook processing delays

- [ ] Database queries are optimized
- [ ] Storage operations are fast
- [ ] No blocking operations in webhook handler
- [ ] Retry logic is not causing delays

## Logging and Debugging

### Enable Debug Logging

```bash
# Set log level to debug
LOG_LEVEL=debug npm run start:dev
```

### View Application Logs

```bash
# Combined logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# Filter for DocuSign logs
tail -f logs/combined.log | grep "DocuSign"
```

### Use ngrok Inspector

```bash
# Access ngrok web interface
open http://127.0.0.1:4040

# View webhook requests and responses
# Replay requests for debugging
```

### Test HMAC Validation Manually

```javascript
// test-hmac.js
const crypto = require('crypto');

const secret = 'your_webhook_secret';
const body = JSON.stringify({
  event: 'envelope-completed',
  data: { envelopeId: 'test-123' }
});

const signature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('base64');

console.log('Body:', body);
console.log('Signature:', signature);
```

```bash
node test-hmac.js
```

## Still Having Issues?

If you've gone through this checklist and still have issues:

1. **Check DocuSign Status**: https://status.docusign.com/
2. **Review Full Logs**: Check `logs/combined.log` for detailed error messages
3. **Test with Postman**: Use Postman to isolate API issues
4. **Check DocuSign Connect Logs**: View webhook delivery logs in DocuSign Admin
5. **Consult Documentation**: See [README.md](./README.md) for detailed guides
6. **Contact Support**: Reach out to DocuSign Developer Support

## Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `CONSENT_REQUIRED` | JWT consent not granted | Grant consent via OAuth URL |
| `INVALID_TOKEN_FORMAT` | Malformed JWT | Check JWT generation logic |
| `USER_AUTHENTICATION_FAILED` | Invalid credentials | Verify integration key and user ID |
| `ENVELOPE_DOES_NOT_EXIST` | Invalid envelope ID | Check envelope ID in request |
| `ACCOUNT_LACKS_PERMISSIONS` | Insufficient permissions | Check account permissions in DocuSign Admin |
| `HMAC_VALIDATION_FAILED` | Invalid webhook signature | Verify webhook secret matches |
| `ONESIGNALLSIGN_NOT_SATISFIED` | Missing signature | Check envelope configuration |
| `INVALID_EMAIL_ADDRESS_FOR_RECIPIENT` | Bad email format | Verify recipient email |

## Useful Commands

```bash
# Generate webhook secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Test DocuSign API connectivity
curl https://demo.docusign.net/restapi/v2.1/accounts

# Check environment variables
env | grep DOCUSIGN

# Restart application
npm run start:dev

# Run all tests
npm test

# Clear node modules and reinstall
rm -rf node_modules package-lock.json && npm install
```
