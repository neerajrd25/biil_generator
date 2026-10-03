import { jsonResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';
import { connectToDatabase } from '../config/db.js';
import { calculateBillTotals, generateSequentialInvoiceNumber, previewNextInvoiceNumber } from '../services/billCalculationService.js';
import { createInvoicePdfBuffer } from '../services/pdfService.js';
import { uploadPdfToGridFS, deletePdfFromGridFS } from '../services/gridFsService.js';
import { ObjectId } from 'mongodb';

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
      if (match && match[1] !== 'next-number' && match[1] !== 'preview') {
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
        return jsonResponse(200, { success: true, bill });
      }

      const search = queryParams.search ? String(queryParams.search).trim() : '';
      const filter = { userId: user.userId };

      if (search) {
        filter.$or = [
          { invoiceNumber: { $regex: search, $options: 'i' } },
          { 'billTo.clientName': { $regex: search, $options: 'i' } },
          { 'billFrom.vendorName': { $regex: search, $options: 'i' } },
        ];
      }

      const bills = await collection.find(filter).sort({ createdAt: -1 }).toArray();
      return jsonResponse(200, {
        success: true,
        count: bills.length,
        bills,
      });
    }

    // POST /bills (Create & optionally commit PDF directly)
    if (method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const {
        lineItems,
        taxRate = 0,
        billFrom = {},
        billTo = {},
        accountDetail = {},
        notes = '',
        dueDate = '',
        savePdf = true,
        currency = 'USD',
        particulars = [],
      } = body;

      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return errorResponse(400, 'At least one line item is required');
      }

      const calculated = calculateBillTotals(lineItems, taxRate);
      const billDate = body.billDate || new Date().toISOString().slice(0, 10);
      const invoiceNumber = body.invoiceNumber || (await generateSequentialInvoiceNumber(user.userId, new Date(billDate)));
      const now = new Date();

      const sanitizedParticulars = Array.isArray(particulars)
        ? particulars
            .filter(p => p && (p.description || '').trim() !== '')
            .map((p, idx) => ({
              srNo: p.srNo || idx + 1,
              description: String(p.description || '').trim(),
              remarks: String(p.remarks || '').trim(),
            }))
        : [];

      const billDoc = {
        userId: user.userId,
        invoiceNumber,
        billDate,
        dueDate,
        currency,
        billFrom: {
          vendorName: billFrom.vendorName || user.name,
          vendorEmail: billFrom.vendorEmail || user.email,
          vendorContact: billFrom.vendorContact || '',
          vendorAddress: billFrom.vendorAddress || '',
          vendorCity: billFrom.vendorCity || '',
          vendorState: billFrom.vendorState || '',
          vendorPin: billFrom.vendorPin || '',
          taxId: billFrom.taxId || '',
        },
        billTo: {
          clientName: billTo.clientName || 'Valued Client',
          clientEmail: billTo.clientEmail || '',
          clientContact: billTo.clientContact || '',
          clientAddress: billTo.clientAddress || '',
          clientCity: billTo.clientCity || '',
          clientState: billTo.clientState || '',
          clientPin: billTo.clientPin || '',
        },
        lineItems: calculated.lineItems,
        particulars: sanitizedParticulars,
        subtotal: calculated.subtotal,
        taxRate: calculated.taxRate,
        taxAmount: calculated.taxAmount,
        total: calculated.total,
        accountDetail: {
          bankName: accountDetail.bankName || '',
          accountHolder: accountDetail.accountHolder || '',
          accountNumber: accountDetail.accountNumber || '',
          ifscCode: accountDetail.ifscCode || '',
        },
        notes,
        status: body.status || 'UNPAID',
        createdAt: now,
        updatedAt: now,
      };

      // Generate & store PDF in MongoDB GridFS
      if (savePdf) {
        try {
          const pdfBuffer = await createInvoicePdfBuffer(billDoc);
          const pdfFileId = await uploadPdfToGridFS({
            buffer: pdfBuffer,
            filename: `${invoiceNumber}.pdf`,
            metadata: {
              userId: user.userId,
              invoiceNumber,
              createdAt: now,
            },
          });
          billDoc.pdfFileId = pdfFileId;
        } catch (pdfErr) {
          console.error('Failed to create/upload PDF to GridFS:', pdfErr);
        }
      }

      const insertResult = await collection.insertOne(billDoc);

      return jsonResponse(201, {
        success: true,
        message: 'Bill created and saved successfully',
        bill: { ...billDoc, _id: insertResult.insertedId },
      });
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

      if (bill.pdfFileId) {
        await deletePdfFromGridFS(bill.pdfFileId).catch(err => console.warn('Could not delete GridFS file:', err));
      }

      await collection.deleteOne({ _id: new ObjectId(billId), userId: user.userId });
      return jsonResponse(200, { success: true, message: 'Bill and associated PDF deleted successfully' });
    }

    return errorResponse(405, `Method ${method} not allowed`);
  } catch (err) {
    console.error('handleBills error:', err);
    const isAuthError = err.message && (err.message.includes('Unauthorized') || err.message.includes('Google Token'));
    return errorResponse(isAuthError ? 401 : 500, err.message || 'Failed to process bills', err);
  }
}
