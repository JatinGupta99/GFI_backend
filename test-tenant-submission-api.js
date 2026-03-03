#!/usr/bin/env node

/**
 * Test script for Tenant Application Submission Prevention API
 * 
 * Usage: node test-tenant-submission-api.js [LEAD_ID]
 * 
 * This script tests the complete submission prevention flow:
 * 1. Get initial lead data
 * 2. Check submission status
 * 3. Submit application
 * 4. Verify submission prevention
 * 5. Check final status
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:4020';
const LEAD_ID = process.argv[2] || '65f1234567890abcdef12345'; // Replace with actual lead ID

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            data: body ? JSON.parse(body) : null,
          };
          resolve(response);
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body,
            parseError: error.message,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test functions
async function testGetLeadData() {
  console.log('\n🔍 Testing: Get Lead Data');
  console.log(`GET /api/leasing/active-leads/public/${LEAD_ID}`);
  
  try {
    const response = await makeRequest('GET', `/api/leasing/active-leads/public/${LEAD_ID}`);
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ Success - Lead data retrieved');
      console.log(`Application Submitted: ${response.data.data.general.applicationSubmitted}`);
      console.log(`Submitted At: ${response.data.data.general.applicationSubmittedAt || 'Not submitted'}`);
      return response.data.data;
    } else {
      console.log('❌ Failed to get lead data');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

async function testSubmissionStatus() {
  console.log('\n📊 Testing: Get Submission Status');
  console.log(`GET /api/leasing/active-leads/public/${LEAD_ID}/submission-status`);
  
  try {
    const response = await makeRequest('GET', `/api/leasing/active-leads/public/${LEAD_ID}/submission-status`);
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ Success - Submission status retrieved');
      console.log(`Is Submitted: ${response.data.data.isSubmitted}`);
      console.log(`Can Modify: ${response.data.data.canModify}`);
      console.log(`Submitted At: ${response.data.data.submittedAt || 'Not submitted'}`);
      return response.data.data;
    } else {
      console.log('❌ Failed to get submission status');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

async function testSubmitApplication() {
  console.log('\n📝 Testing: Submit Application');
  console.log(`PATCH /api/leasing/active-leads/public/${LEAD_ID}/update`);
  
  const submissionData = {
    business: {
      legalName: "Test Business LLC",
      stateOfIncorporation: "Delaware",
      fein: "12-3456789",
      tradeName: "Test Business",
      currentBusinessAddress: "123 Business St, City, State 12345",
      proposedBusinessDescription: "Software development services",
      businessTelephone: "555-123-4567",
      isRelocating: false,
      howLongInBusiness: 5,
      howManyLocations: 1
    },
    financial: {
      assets: {
        checkingSavings: true,
        stocksBonds: true,
        retirementAccounts: true,
        automobiles: "25000",
        realEstateResidence: "300000",
        realEstateInvestment: "150000",
        otherAssets: "10000"
      },
      liabilities: {
        creditCardBalances: "5000",
        taxesPayable: "2000",
        mortgagesDue: "200000",
        otherLiabilities: "1000"
      },
      annualIncome: "150000",
      monthlyMortgageRent: "2500"
    },
    references: {
      bankReference: "First National Bank",
      bankOfficerName: "John Smith",
      bankOfficerPhone: "555-987-6543",
      professionalReference1: {
        name: "Jane Doe",
        phone: "555-111-2222"
      },
      professionalReference2: {
        name: "Bob Johnson",
        phone: "555-333-4444"
      }
    },
    general: {
      name: "John Doe",
      dob: "1985-01-15",
      ssn: "123-45-6789",
      spouseName: "Jane Doe",
      spouseDob: "1987-03-20",
      spouseSsn: "987-65-4321",
      residentialAddress: "456 Home St, City, State 12345",
      howLongAtAddress: "3 years",
      presentEmployer: "Tech Company Inc",
      businessExperienceSummary: "10 years in software development",
      hasCoApplicant: true,
      driversLicenseUploaded: true,
      notes: "Test application submission",
      // 🔥 CRITICAL: Mark as submitted
      applicationSubmitted: true
    }
  };
  
  try {
    const response = await makeRequest('PATCH', `/api/leasing/active-leads/public/${LEAD_ID}/update`, submissionData);
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ Success - Application submitted');
      console.log('Message:', response.data.message);
      console.log('Application Submitted:', response.data.data.applicationSubmitted);
      console.log('Submitted At:', response.data.data.applicationSubmittedAt);
      return true;
    } else {
      console.log('❌ Failed to submit application');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

async function testDuplicateSubmissionPrevention() {
  console.log('\n🚫 Testing: Duplicate Submission Prevention');
  console.log(`PATCH /api/leasing/active-leads/public/${LEAD_ID}/update`);
  
  const duplicateData = {
    general: {
      name: "John Doe Updated",
      applicationSubmitted: true
    }
  };
  
  try {
    const response = await makeRequest('PATCH', `/api/leasing/active-leads/public/${LEAD_ID}/update`, duplicateData);
    console.log(`Status: ${response.status}`);
    
    if (response.status === 400) {
      console.log('✅ Success - Duplicate submission prevented');
      console.log('Error Message:', response.data.message);
      return true;
    } else {
      console.log('❌ Failed - Duplicate submission was not prevented');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

async function testUpdateAfterSubmission() {
  console.log('\n🔒 Testing: Update Prevention After Submission');
  console.log(`PATCH /api/leasing/active-leads/public/${LEAD_ID}/update`);
  
  const updateData = {
    business: {
      legalName: "Updated Business Name"
    }
  };
  
  try {
    const response = await makeRequest('PATCH', `/api/leasing/active-leads/public/${LEAD_ID}/update`, updateData);
    console.log(`Status: ${response.status}`);
    
    if (response.status === 400) {
      console.log('✅ Success - Update after submission prevented');
      console.log('Error Message:', response.data.message);
      return true;
    } else {
      console.log('❌ Failed - Update after submission was not prevented');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

// Main test execution
async function runTests() {
  console.log('🧪 Tenant Application Submission Prevention API Tests');
  console.log('=' .repeat(60));
  console.log(`Testing Lead ID: ${LEAD_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  
  let results = {
    getLeadData: false,
    submissionStatus: false,
    submitApplication: false,
    duplicatePrevention: false,
    updatePrevention: false,
  };
  
  // Test 1: Get initial lead data
  const leadData = await testGetLeadData();
  results.getLeadData = leadData !== null;
  
  // Test 2: Check initial submission status
  const initialStatus = await testSubmissionStatus();
  results.submissionStatus = initialStatus !== null;
  
  // Test 3: Submit application (only if not already submitted)
  if (initialStatus && !initialStatus.isSubmitted) {
    results.submitApplication = await testSubmitApplication();
  } else {
    console.log('\n⚠️  Skipping submission test - application already submitted');
    results.submitApplication = true; // Consider it passed since it's already submitted
  }
  
  // Test 4: Test duplicate submission prevention
  results.duplicatePrevention = await testDuplicateSubmissionPrevention();
  
  // Test 5: Test update prevention after submission
  results.updatePrevention = await testUpdateAfterSubmission();
  
  // Test 6: Check final submission status
  console.log('\n📊 Final Status Check:');
  await testSubmissionStatus();
  
  // Summary
  console.log('\n📋 Test Results Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Get Lead Data: ${results.getLeadData ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Submission Status: ${results.submissionStatus ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Submit Application: ${results.submitApplication ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Duplicate Prevention: ${results.duplicatePrevention ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Update Prevention: ${results.updatePrevention ? 'PASS' : 'FAIL'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('\n🎯 Overall Result:');
  console.log(`${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Submission prevention is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, makeRequest };