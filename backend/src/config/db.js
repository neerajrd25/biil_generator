import { MongoClient, GridFSBucket } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

let cachedClient = null;
let cachedDb = null;
let cachedGridFS = null;

const MONGODB_URI = process.env.DB_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'bill_generator';

export async function connectToDatabase() {
  if (cachedDb && cachedClient) {
    return { client: cachedClient, db: cachedDb, bucket: cachedGridFS };
  }

  if (!MONGODB_URI) {
    throw new Error('Database connection error: DB_URL or MONGODB_URI environment variable is missing.');
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(DB_NAME);
  const bucket = new GridFSBucket(db, { bucketName: 'invoice_pdfs' });

  // Ensure necessary indexes
  await Promise.all([
    db.collection('users').createIndex({ googleId: 1 }, { unique: true }),
    db.collection('billing_profiles').createIndex({ userId: 1 }),
    db.collection('clients').createIndex({ userId: 1, clientName: 1 }),
    db.collection('bills').createIndex({ userId: 1, invoiceNumber: 1 }),
    db.collection('bills').createIndex({ userId: 1, createdAt: -1 })
  ]).catch(err => console.warn('Indexes warning:', err.message));

  cachedClient = client;
  cachedDb = db;
  cachedGridFS = bucket;

  return { client, db, bucket };
}
