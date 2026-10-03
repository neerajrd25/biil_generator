import { jsonResponse, binaryResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';
import { connectToDatabase } from '../config/db.js';
import { createInvoicePdfBuffer } from '../services/pdfService.js';
import { getPdfFromGridFS, uploadPdfToGridFS } from '../services/gridFsService.js';
import { getLogoBuffer } from '../services/brandingService.js';
import { calculateBillTotals } from '../services/billCalculationService.js';
import { ObjectId } from 'mongodb';

export async function handlePdf(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const user = await verifyGoogleTokenAndGetUser(authHeader);

    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    const path = event.path || event.requestContext?.http?.path || '';

    // POST /bills/preview -> Generates live PDF buffer without saving
    if (path.endsWith('/preview') && method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const calculated = calculateBillTotals(body.lineItems || [], body.taxRate || 0);

      const billData = {
        ...body,
        ...calculated,
        invoiceNumber: body.invoiceNumber || 'PREVIEW',
      };

      const pdfBuffer = await createInvoicePdfBuffer(billData, { logo: await getLogoBuffer(user.userId) });
      return binaryResponse(200, pdfBuffer, 'application/pdf', `${billData.invoiceNumber}.pdf`);
    }

    // GET /bills/{id}/pdf -> Retrieves stored PDF directly from GridFS
    if (method === 'GET') {
      const rawPath = event.rawPath || event.path || '';
      const pathParams = event.pathParameters || {};
      let billId = pathParams.id || event.queryStringParameters?.id;

      if (!billId && rawPath) {
        const match = rawPath.match(/\/bills\/([^/]+)\/pdf/i);
        if (match) {
          billId = match[1];
        }
      }

      if (!billId) {
        return errorResponse(400, 'Bill ID is required');
      }

      if (!ObjectId.isValid(billId)) {
        return errorResponse(400, 'Invalid Bill ID format');
      }

      const { db } = await connectToDatabase();
      const bill = await db.collection('bills').findOne({ _id: new ObjectId(billId), userId: user.userId });

      if (!bill) {
        return errorResponse(404, 'Bill record not found');
      }

      if (bill.pdfFileId) {
        try {
          const { buffer, fileDoc } = await getPdfFromGridFS(bill.pdfFileId);
          return binaryResponse(200, buffer, 'application/pdf', fileDoc.filename || `${bill.invoiceNumber}.pdf`);
        } catch (gridFsErr) {
          console.warn('GridFS fetch error, fallback to dynamically generating PDF:', gridFsErr.message);
        }
      }

      // If PDF wasn't stored or needs regeneration
      const pdfBuffer = await createInvoicePdfBuffer(bill, { logo: await getLogoBuffer(user.userId) });
      return binaryResponse(200, pdfBuffer, 'application/pdf', `${bill.invoiceNumber}.pdf`);
    }

    return errorResponse(405, `Method ${method} not allowed for PDF endpoint`);
  } catch (err) {
    console.error('handlePdf error:', err);
    const isAuthError = err.message && (err.message.includes('Unauthorized') || err.message.includes('Google Token'));
    return errorResponse(isAuthError ? 401 : 500, err.message || 'Failed to process PDF', err);
  }
}
