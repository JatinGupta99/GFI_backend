#!/usr/bin/env node

/**
 * Generate a secure random webhook secret for DocuSign HMAC validation
 * 
 * Usage:
 *   node scripts/generate-webhook-secret.js
 */

const crypto = require('crypto');

console.log('\n===========================================');
console.log('DocuSign Webhook Secret Generator');
console.log('===========================================\n');

const secret = crypto.randomBytes(32).toString('hex');

console.log('Your webhook secret:');
console.log('-------------------------------------------');
console.log(secret);
console.log('-------------------------------------------\n');

console.log('Add this to your .env file:');
console.log(`DOCUSIGN_WEBHOOK_SECRET=${secret}\n`);

console.log('IMPORTANT: Keep this secret secure!');
console.log('- Do not commit it to version control');
console.log('- Use the same secret in DocuSign Connect configuration');
console.log('- Store it securely in production environments\n');
