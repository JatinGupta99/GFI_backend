/**
 * Test script for the Enhanced Email API
 * Demonstrates usage of the new email API with SOLID and DRY principles
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual JWT token

// Test data
const testEmails = {
  basic: {
    to: 'tenant@example.com',
    subject: 'Welcome to Our Platform',
    body: '<div><h1>Welcome!</h1><p>Thank you for joining our platform.</p></div>',
    priority: 'normal'
  },
  
  loiWithAttachments: {
    to: 'tenant@example.com',
    cc: ['manager@company.com', 'legal@company.com'],
    subject: 'LOI for Suite 100 at Property Name',
    body: `
      <div>
        <h2>Letter of Intent</h2>
        <p>Dear Tenant,</p>
        <p>Please find attached the Letter of Intent for Suite 100 at Property Name.</p>
        <div class="highlight">
          <strong>Important:</strong> Please review all documents carefully and return signed copies within 5 business days.
        </div>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>Property Management Team</p>
      </div>
    `,
    attachments: ['attachment-id-1', 'attachment-id-2'],
    loiKey: 'documents/lead-69a49bcc4a4f3730af4d3b58/loi-pdf-s3-key',
    priority: 'high',
    metadata: {
      leadId: '69a49bcc4a4f3730af4d3b58',
      propertyId: 'prop-123',
      templateId: 'loi-template',
      source: 'api-test'
    }
  },

  withBcc: {
    to: 'tenant@example.com',
    cc: ['manager@company.com'],
    bcc: ['audit@company.com', 'compliance@company.com'],
    subject: 'Lease Agreement Update',
    body: '<div><h2>Lease Agreement Update</h2><p>Your lease agreement has been updated.</p></div>',
    priority: 'normal'
  }
};

// Helper function to make API requests
async function makeRequest(endpoint, data, method = 'POST') {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ Request failed:`, {
      endpoint,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      details: error.response?.data?.details
    });
    throw error;
  }
}

// Test functions
async function testBasicEmail() {
  console.log('\n📧 Testing Basic Email...');
  
  try {
    const result = await makeRequest('/email/send', testEmails.basic);
    
    console.log('✅ Basic email sent successfully:', {
      messageId: result.data.messageId,
      sentAt: result.data.sentAt,
      duration: result.data.metadata.duration,
      recipientCount: result.data.metadata.recipientCount
    });
    
    return result;
  } catch (error) {
    console.error('❌ Basic email test failed');
    throw error;
  }
}

async function testLOIEmailWithAttachments() {
  console.log('\n📧 Testing LOI Email with Attachments...');
  
  try {
    const result = await makeRequest('/email/send', testEmails.loiWithAttachments);
    
    console.log('✅ LOI email sent successfully:', {
      messageId: result.data.messageId,
      sentAt: result.data.sentAt,
      duration: result.data.metadata.duration,
      recipientCount: result.data.metadata.recipientCount,
      attachmentCount: result.data.metadata.attachmentCount
    });
    
    return result;
  } catch (error) {
    console.error('❌ LOI email test failed');
    throw error;
  }
}

async function testEmailWithBCC() {
  console.log('\n📧 Testing Email with BCC...');
  
  try {
    const result = await makeRequest('/email/send', testEmails.withBcc);
    
    console.log('✅ BCC email sent successfully:', {
      messageId: result.data.messageId,
      sentAt: result.data.sentAt,
      recipientCount: result.data.metadata.recipientCount
    });
    
    return result;
  } catch (error) {
    console.error('❌ BCC email test failed');
    throw error;
  }
}

async function testBatchEmails() {
  console.log('\n📧 Testing Batch Email Sending...');
  
  const batchRequest = {
    emails: [
      {
        to: 'tenant1@example.com',
        subject: 'Batch Email 1',
        body: '<div><h2>Batch Email 1</h2><p>This is the first email in the batch.</p></div>',
        metadata: { batchId: 'batch-001', index: 1 }
      },
      {
        to: 'tenant2@example.com',
        subject: 'Batch Email 2',
        body: '<div><h2>Batch Email 2</h2><p>This is the second email in the batch.</p></div>',
        metadata: { batchId: 'batch-001', index: 2 }
      },
      {
        to: 'tenant3@example.com',
        subject: 'Batch Email 3',
        body: '<div><h2>Batch Email 3</h2><p>This is the third email in the batch.</p></div>',
        attachments: ['attachment-id-1'],
        metadata: { batchId: 'batch-001', index: 3 }
      }
    ],
    options: {
      concurrency: 2,
      delayBetweenEmails: 500,
      continueOnError: true
    }
  };
  
  try {
    const result = await makeRequest('/email/send-batch', batchRequest);
    
    console.log('✅ Batch emails processed:', {
      totalEmails: batchRequest.emails.length,
      successful: result.data.successful,
      failed: result.data.failed,
      successRate: `${((result.data.successful / batchRequest.emails.length) * 100).toFixed(1)}%`
    });
    
    // Show individual results
    result.data.results.forEach((emailResult, index) => {
      const status = emailResult.success ? '✅' : '❌';
      console.log(`  ${status} ${emailResult.email}: ${emailResult.messageId || emailResult.error}`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ Batch email test failed');
    throw error;
  }
}

async function testValidationErrors() {
  console.log('\n📧 Testing Validation Errors...');
  
  const invalidEmails = [
    {
      name: 'Invalid email format',
      data: {
        to: 'invalid-email',
        subject: 'Test',
        body: '<div>Test</div>'
      }
    },
    {
      name: 'Empty subject',
      data: {
        to: 'valid@example.com',
        subject: '',
        body: '<div>Test</div>'
      }
    },
    {
      name: 'Empty body',
      data: {
        to: 'valid@example.com',
        subject: 'Test Subject',
        body: ''
      }
    },
    {
      name: 'Invalid CC email',
      data: {
        to: 'valid@example.com',
        cc: ['invalid-cc-email'],
        subject: 'Test Subject',
        body: '<div>Test</div>'
      }
    }
  ];
  
  for (const testCase of invalidEmails) {
    try {
      await makeRequest('/email/send', testCase.data);
      console.log(`❌ ${testCase.name}: Should have failed but didn't`);
    } catch (error) {
      console.log(`✅ ${testCase.name}: Correctly rejected - ${error.response?.data?.message}`);
    }
  }
}

async function testPerformanceMetrics() {
  console.log('\n📊 Testing Performance Metrics...');
  
  const startTime = Date.now();
  
  try {
    const result = await makeRequest('/email/send', testEmails.basic);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log('📊 Performance Metrics:', {
      totalRequestTime: `${totalTime}ms`,
      emailProcessingTime: `${result.data.metadata.duration}ms`,
      networkOverhead: `${totalTime - result.data.metadata.duration}ms`,
      recipientCount: result.data.metadata.recipientCount,
      attachmentCount: result.data.metadata.attachmentCount || 0
    });
    
  } catch (error) {
    console.error('❌ Performance test failed');
    throw error;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Enhanced Email API Tests');
  console.log('=====================================');
  
  const tests = [
    { name: 'Basic Email', fn: testBasicEmail },
    { name: 'LOI Email with Attachments', fn: testLOIEmailWithAttachments },
    { name: 'Email with BCC', fn: testEmailWithBCC },
    { name: 'Batch Emails', fn: testBatchEmails },
    { name: 'Validation Errors', fn: testValidationErrors },
    { name: 'Performance Metrics', fn: testPerformanceMetrics }
  ];
  
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 Running: ${test.name}`);
      await test.fn();
      results.passed++;
      console.log(`✅ ${test.name} - PASSED`);
    } catch (error) {
      results.failed++;
      results.errors.push({ test: test.name, error: error.message });
      console.log(`❌ ${test.name} - FAILED`);
    }
  }
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / tests.length) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach(error => {
      console.log(`  - ${error.test}: ${error.error}`);
    });
  }
  
  console.log('\n🎉 Testing completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testBasicEmail,
  testLOIEmailWithAttachments,
  testEmailWithBCC,
  testBatchEmails,
  testValidationErrors,
  testPerformanceMetrics,
  runAllTests
};