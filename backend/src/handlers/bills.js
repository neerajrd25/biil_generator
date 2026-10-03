import { jsonResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';
import { connectToDatabase } from '../config/db.js';
import { generateSequentialInvoiceNumber, previewNextInvoiceNumber } from '../services/billCalculationService.js';
import {
  PAYMENT_STATUS,
  ValidationError,
  buildInvoiceContent,
  buildPaymentUpdate,
  derivePaymentStatus,
  escapeRegex,
  getAmountPaid,
  isValidDateString,
  presentBill,
} from '../services/invoiceService.js';
import { getLogoBuffer } from '../services/brandingService.js';
import { upsertClientFromBill } from '../services/clientService.js';
import { createInvoicePdfBuffer } from '../services/pdfService.js';
import { uploadPdfToGridFS, deletePdfFromGridFS } from '../services/gridFsService.js';
import { ObjectId } from 'mongodb';

const RESERVED_BILL_PATHS = ['next-number', 'preview', 'lock-period'];

function parseBody(event) {
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  } catch {
    throw new ValidationError('Request body is not valid JSON');
  }
}

function validateBillId(billId) {
  if (!billId) return errorResponse(400, 'Bill id is required');
  if (!ObjectId.isValid(billId)) return errorResponse(400, 'Invalid Bill ID format');
  return null;
}

function getEditBlockReason(bill) {
  if (bill.status === PAYMENT_STATUS.VOID) return 'Void invoices cannot be edited.';
  if (bill.isLocked === true) return 'This invoice is locked. Unlock it to make changes.';
  return null;
}

/** Returns the GridFS file id, or null if the PDF could not be stored (it is regenerated on demand). */
async function storeInvoicePdf(bill, userId) {
  try {
    const pdfBuffer = await createInvoicePdfBuffer(bill, { logo: await getLogoBuffer(userId) });
    return await uploadPdfToGridFS({
      buffer: pdfBuffer,
      filename: `${bill.invoiceNumber}.pdf`,
      metadata: { userId, invoiceNumber: bill.invoiceNumber, createdAt: new Date() },
    });
  } catch (pdfErr) {
    console.error('Failed to create/upload PDF to GridFS:', pdfErr);
    return null;
  }
}

export async function handleBills(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const user = await verifyGoogleTokenAndGetUser(authHeader);
    const { db } = await connectToDatabase();
    const collection = db.collection('bills');

    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    const pathParams = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};
    const rawPath = event.rawPath || event.path || '';
    let billId = pathParams.id || queryParams.id;

    if (!billId && rawPath) {
      const match = rawPath.match(/^\/bills\/([^/]+)$/);
      if (match && !RESERVED_BILL_PATHS.includes(match[1])) {
        billId = match[1];
      }
    }

    // GET /bills/next-number
    if (method === 'GET' && (rawPath.endsWith('/next-number') || queryParams.action === 'next-number')) {
      const nextInvoiceNumber = await previewNextInvoiceNumber(user.userId, queryParams.date ? new Date(queryParams.date) : new Date());
      return jsonResponse(200, { success: true, nextInvoiceNumber });
    }

    // GET /bills OR GET /bills/{id}
    if (method === 'GET') {
      if (billId) {
        if (!ObjectId.isValid(billId)) {
          return errorResponse(400, 'Invalid Bill ID format');
        }
        const bill = await collection.findOne({ _id: new ObjectId(billId), userId: user.userId });
        if (!bill) {
          return errorResponse(404, 'Invoice bill not found');
        }
        return jsonResponse(200, { success: true, bill: presentBill(bill) });
      }

      const search = queryParams.search ? escapeRegex(String(queryParams.search).trim()) : '';
      const filter = { userId: user.userId };

      if (search) {
        filter.$or = [
          { invoiceNumber: { $regex: search, $options: 'i' } },
          { 'billTo.clientName': { $regex: search, $options: 'i' } },
          { 'billTo.clientEmail': { $regex: search, $options: 'i' } },
          { 'billFrom.vendorName': { $regex: search, $options: 'i' } },
        ];
      }

      const bills = (await collection.find(filter).sort({ createdAt: -1 }).toArray()).map((b) => presentBill(b));
      return jsonResponse(200, {
        success: true,
        count: bills.length,
        bills,
      });
    }

    // POST /bills/lock-period -> lock every invoice dated on or before `upTo`
    if (method === 'POST' && rawPath.endsWith('/lock-period')) {
      const body = parseBody(event);
      if (!isValidDateString(body.upTo)) {
        return errorResponse(400, 'upTo must be a date in YYYY-MM-DD format');
      }
      const result = await collection.updateMany(
        { userId: user.userId, billDate: { $lte: body.upTo }, isLocked: { $ne: true } },
        { $set: { isLocked: true, lockedAt: new Date(), updatedAt: new Date() } }
      );
      return jsonResponse(200, {
        success: true,
        message: `Locked ${result.modifiedCount} invoice(s) dated on or before ${body.upTo}`,
        lockedCount: result.modifiedCount,
      });
    }

    // POST /bills (Create & optionally commit PDF directly)
    if (method === 'POST') {
      const body = parseBody(event);
      const content = buildInvoiceContent(body, user);
      const invoiceNumber = body.invoiceNumber || (await generateSequentialInvoiceNumber(user.userId, new Date(content.billDate)));
      const now = new Date();

      const billDoc = {
        userId: user.userId,
        invoiceNumber,
        ...content,
        amountPaid: 0,
        status: PAYMENT_STATUS.UNPAID,
        isLocked: false,
        createdAt: now,
        updatedAt: now,
      };

      // Generate & store PDF in MongoDB GridFS
      if (body.savePdf !== false) {
        billDoc.pdfFileId = await storeInvoicePdf(billDoc, user.userId);
        if (!billDoc.pdfFileId) delete billDoc.pdfFileId;
      }

      const insertResult = await collection.insertOne(billDoc);
      await upsertClientFromBill(db, user.userId, billDoc.billTo);

      return jsonResponse(201, {
        success: true,
        message: 'Bill created and saved successfully',
        bill: presentBill({ ...billDoc, _id: insertResult.insertedId }),
      });
    }

    // PUT /bills/{id} (Edit an unlocked invoice)
    if (method === 'PUT') {
      const idError = validateBillId(billId);
      if (idError) return idError;

      const existing = await collection.findOne({ _id: new ObjectId(billId), userId: user.userId });
      if (!existing) {
        return errorResponse(404, 'Bill not found');
      }
      const blocked = getEditBlockReason(existing);
      if (blocked) return errorResponse(423, blocked);

      const content = buildInvoiceContent(parseBody(event), user);
      const merged = { ...existing, ...content };
      const amountPaid = getAmountPaid(merged);
      const updatedDoc = {
        ...content,
        amountPaid,
        status: derivePaymentStatus({ ...merged, amountPaid, status: undefined }),
        updatedAt: new Date(),
      };

      // The stored PDF would now be stale: replace it (or drop it so it is regenerated on demand).
      const newPdfFileId = await storeInvoicePdf({ ...existing, ...updatedDoc }, user.userId);
      const update = newPdfFileId
        ? { $set: { ...updatedDoc, pdfFileId: newPdfFileId } }
        : { $set: updatedDoc, $unset: { pdfFileId: '' } };

      // The isLocked guard closes the race where the invoice is locked while this edit is in flight.
      const result = await collection.updateOne(
        { _id: existing._id, userId: user.userId, isLocked: { $ne: true }, status: { $ne: PAYMENT_STATUS.VOID } },
        update
      );
      if (result.matchedCount === 0) {
        if (newPdfFileId) await deletePdfFromGridFS(newPdfFileId).catch(() => {});
        return errorResponse(423, 'This invoice was locked or voided and can no longer be edited');
      }

      if (existing.pdfFileId) {
        await deletePdfFromGridFS(existing.pdfFileId).catch(err => console.warn('Could not delete old GridFS file:', err));
      }
      await upsertClientFromBill(db, user.userId, updatedDoc.billTo);

      const saved = await collection.findOne({ _id: existing._id });
      return jsonResponse(200, { success: true, message: 'Invoice updated', bill: presentBill(saved) });
    }

    // PATCH /bills/{id} -> { action: 'lock' | 'unlock' | 'void' | 'payment', amountPaid? }
    if (method === 'PATCH') {
      const idError = validateBillId(billId);
      if (idError) return idError;

      const bill = await collection.findOne({ _id: new ObjectId(billId), userId: user.userId });
      if (!bill) {
        return errorResponse(404, 'Bill not found');
      }

      const { action, amountPaid } = parseBody(event);
      const now = new Date();
      let set;
      let message;

      if (action === 'lock') {
        set = { isLocked: true, lockedAt: now };
        message = 'Invoice locked';
      } else if (action === 'unlock') {
        set = { isLocked: false, lockedAt: null };
        message = 'Invoice unlocked';
      } else if (action === 'void') {
        if (bill.status === PAYMENT_STATUS.VOID) return errorResponse(409, 'Invoice is already void');
        if (getAmountPaid(bill) > 0) {
          return errorResponse(409, 'This invoice has payments recorded. Set the amount received to 0 before voiding it.');
        }
        set = { status: PAYMENT_STATUS.VOID, voidedAt: now, isLocked: true, lockedAt: bill.lockedAt || now };
        message = 'Invoice voided';
      } else if (action === 'payment') {
        if (bill.status === PAYMENT_STATUS.VOID) return errorResponse(409, 'Payments cannot be recorded on a void invoice');
        set = buildPaymentUpdate(bill, amountPaid);
        message = 'Payment recorded';
      } else {
        return errorResponse(400, "action must be one of: lock, unlock, void, payment");
      }

      await collection.updateOne({ _id: bill._id, userId: user.userId }, { $set: { ...set, updatedAt: now } });
      const saved = await collection.findOne({ _id: bill._id });
      return jsonResponse(200, { success: true, message, bill: presentBill(saved) });
    }

    // DELETE /bills/{id}
    if (method === 'DELETE') {
      if (!billId) {
        return errorResponse(400, 'Bill id is required');
      }

      if (!ObjectId.isValid(billId)) {
        return errorResponse(400, 'Invalid Bill ID format');
      }

      const bill = await collection.findOne({ _id: new ObjectId(billId), userId: user.userId });
      if (!bill) {
        return errorResponse(404, 'Bill not found');
      }
      if (bill.isLocked === true) {
        return errorResponse(423, 'This invoice is locked. Unlock it first, or void it to keep the record.');
      }

      if (bill.pdfFileId) {
        await deletePdfFromGridFS(bill.pdfFileId).catch(err => console.warn('Could not delete GridFS file:', err));
      }

      await collection.deleteOne({ _id: new ObjectId(billId), userId: user.userId, isLocked: { $ne: true } });
      return jsonResponse(200, { success: true, message: 'Bill and associated PDF deleted successfully' });
    }

    return errorResponse(405, `Method ${method} not allowed`);
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(400, err.message);
    }
    console.error('handleBills error:', err);
    const isAuthError = err.message && (err.message.includes('Unauthorized') || err.message.includes('Google Token'));
    return errorResponse(isAuthError ? 401 : 500, err.message || 'Failed to process bills', err);
  }
}
