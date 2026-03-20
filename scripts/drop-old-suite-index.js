// Script to drop old suite index and create new one
// Run this with: node scripts/drop-old-suite-index.js

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function migrateIndexes() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;
  
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const suitesCollection = db.collection('suites');

    // Get existing indexes
    const indexes = await suitesCollection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Drop the old index if it exists
    try {
      await suitesCollection.dropIndex('propertyId_1_number_1');
      console.log('✅ Dropped old index: propertyId_1_number_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Old index does not exist (already dropped)');
      } else {
        throw error;
      }
    }

    // Create the new index
    await suitesCollection.createIndex(
      { propertyId: 1, suiteId: 1 },
      { unique: true, name: 'propertyId_1_suiteId_1' }
    );
    console.log('✅ Created new index: propertyId_1_suiteId_1');

    // Verify new indexes
    const newIndexes = await suitesCollection.indexes();
    console.log('Updated indexes:', newIndexes.map(i => i.name));

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateIndexes();
