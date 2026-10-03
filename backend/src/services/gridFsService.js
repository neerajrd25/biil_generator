import { Readable } from 'stream';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../config/db.js';

/**
 * Uploads a PDF buffer into MongoDB GridFS
 * @returns {Promise<ObjectId>} The fileId in GridFS
 */
export async function uploadPdfToGridFS({ buffer, filename, metadata }) {
  const { bucket } = await connectToDatabase();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'application/pdf',
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
      },
    });

    const readable = Readable.from(buffer);
    readable.pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        resolve(uploadStream.id);
      });
  });
}

/**
 * Downloads a PDF buffer from MongoDB GridFS by fileId
 * @returns {Promise<{ buffer: Buffer, fileDoc: Object }>}
 */
export async function getPdfFromGridFS(fileId) {
  const { bucket, db } = await connectToDatabase();
  const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;

  const fileDoc = await db.collection('invoice_pdfs.files').findOne({ _id: objectId });
  if (!fileDoc) {
    throw new Error('Invoice PDF file not found in GridFS');
  }

  return new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(objectId);
    const chunks = [];

    downloadStream.on('data', chunk => chunks.push(chunk));
    downloadStream.on('error', reject);
    downloadStream.on('end', () => {
      resolve({
        buffer: Buffer.concat(chunks),
        fileDoc,
      });
    });
  });
}

/**
 * Deletes a PDF file from GridFS
 */
export async function deletePdfFromGridFS(fileId) {
  const { bucket } = await connectToDatabase();
  const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
  await bucket.delete(objectId);
}
