// Simple test to verify the documents module can be imported
const { Test } = require('@nestjs/testing');

async function testDocumentsModule() {
  try {
    // Try to import the module
    const { DocumentsModule } = require('./dist/modules/documents/documents.module');
    const { DocumentsController } = require('./dist/modules/documents/controllers/documents.controller');
    
    console.log('✅ DocumentsModule imported successfully');
    console.log('✅ DocumentsController imported successfully');
    
    // Try to create a test module
    const moduleRef = await Test.createTestingModule({
      imports: [DocumentsModule],
    }).compile();
    
    const controller = moduleRef.get(DocumentsController);
    console.log('✅ DocumentsController instantiated successfully');
    
    console.log('🎉 Documents module is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing documents module:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDocumentsModule();