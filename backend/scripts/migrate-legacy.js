import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const DB_URL = process.env.DB_URL;

/**
 * Migration script: Migrates legacy records from 'bill_details' to the v2 'bills' schema
 * Run with: node scripts/migrate-legacy.js
 */
async function migrateLegacyBills() {
  if (!DB_URL) {
    console.error('Missing DB_URL in environment variables.');
    process.exit(1);
  }

  const client = new MongoClient(DB_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'bill_generator');

  console.log('Checking for legacy "bill_details" collection...');
  const collections = await db.listCollections({ name: 'bill_details' }).toArray();

  if (collections.length === 0) {
    console.log('No legacy "bill_details" collection found. Migration not needed.');
    await client.close();
    return;
  }

  const legacyBills = await db.collection('bill_details').find({}).toArray();
  console.log(`Found ${legacyBills.length} legacy bill record(s) to process.`);

  let migratedCount = 0;
  for (const legacy of legacyBills) {
    const existing = await db.collection('bills').findOne({ invoiceNumber: legacy.invoiceNumber });
    if (existing) {
      continue;
    }

    const newBill = {
      legacyId: legacy._id,
      userId: legacy.userId || 'legacy_imported_user',
      invoiceNumber: legacy.invoiceNumber || `LEGACY-${Date.now()}`,
      billDate: legacy.billDate || new Date().toISOString().slice(0, 10),
      dueDate: '',
      billFrom: {
        vendorName: legacy.billFrom?.vendorName || '',
        vendorEmail: legacy.billFrom?.vendorEmail || '',
        vendorContact: legacy.billFrom?.vendorContact || '',
        vendorAddress: legacy.billFrom?.vendorAddress || '',
        vendorCity: legacy.billFrom?.vendorCity || '',
        vendorState: legacy.billFrom?.vendorState || '',
        vendorPin: legacy.billFrom?.vendorPin || '',
        taxId: '',
      },
      billTo: {
        clientName: legacy.billTo?.clientName || 'Valued Client',
        clientEmail: legacy.billTo?.clientEmail || '',
        clientContact: legacy.billTo?.clientContact || '',
        clientAddress: legacy.billTo?.clientAddress || '',
        clientCity: legacy.billTo?.clientCity || '',
        clientState: legacy.billTo?.clientState || '',
        clientPin: legacy.billTo?.clientPin || '',
      },
      lineItems: Array.isArray(legacy.lineItems) ? legacy.lineItems : [],
      subtotal: legacy.totalPrice || 0,
      taxRate: 0,
      taxAmount: 0,
      total: legacy.totalPrice || 0,
      accountDetail: legacy.accountDetail || {},
      notes: legacy.notes || '',
      status: 'PAID',
      createdAt: legacy.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await db.collection('bills').insertOne(newBill);
    migratedCount++;
  }

  console.log(`Successfully migrated ${migratedCount} bill(s) to the new 'bills' collection.`);
  await client.close();
}

migrateLegacyBills().catch(console.error);
