import { jsonResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';
import { connectToDatabase } from '../config/db.js';

export async function handleBillingProfile(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const user = await verifyGoogleTokenAndGetUser(authHeader);
    const { db } = await connectToDatabase();
    const collection = db.collection('billing_profiles');

    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

    if (method === 'GET') {
      const profile = await collection.findOne({ userId: user.userId });
      return jsonResponse(200, {
        success: true,
        profile: profile || {
          vendorName: user.name || '',
          vendorEmail: user.email || '',
          vendorContact: '',
          vendorAddress: '',
          vendorCity: '',
          vendorState: '',
          vendorPin: '',
          taxId: '',
          defaultCurrency: 'USD',
          invoiceSettings: {
            prefix: 'NV',
            format: 'DATE_BASED',
            separator: '',
            digits: 3,
            nextSequence: 1,
          },
          accountDetail: {
            bankName: '',
            accountHolder: '',
            accountNumber: '',
            ifscCode: '',
          },
        },
      });
    }

    if (method === 'POST' || method === 'PUT') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const now = new Date();

      const profileData = {
        vendorName: body.vendorName || '',
        vendorEmail: body.vendorEmail || '',
        vendorContact: body.vendorContact || '',
        vendorAddress: body.vendorAddress || '',
        vendorCity: body.vendorCity || '',
        vendorState: body.vendorState || '',
        vendorPin: body.vendorPin || '',
        taxId: body.taxId || '',
        defaultCurrency: body.defaultCurrency || 'USD',
        invoiceSettings: {
          prefix: (body.invoiceSettings?.prefix || 'NV').trim(),
          format: body.invoiceSettings?.format || 'DATE_BASED',
          separator: body.invoiceSettings?.separator ?? '',
          digits: Math.max(1, Number(body.invoiceSettings?.digits) || 3),
          nextSequence: Math.max(1, Number(body.invoiceSettings?.nextSequence) || 1),
        },
        accountDetail: {
          bankName: body.accountDetail?.bankName || '',
          accountHolder: body.accountDetail?.accountHolder || '',
          accountNumber: body.accountDetail?.accountNumber || '',
          ifscCode: body.accountDetail?.ifscCode || '',
        },
        updatedAt: now,
      };

      const result = await collection.findOneAndUpdate(
        { userId: user.userId },
        {
          $set: profileData,
          $setOnInsert: { userId: user.userId, createdAt: now },
        },
        { upsert: true, returnDocument: 'after' }
      );

      return jsonResponse(200, {
        success: true,
        message: 'Billing profile updated successfully',
        profile: result.value || result,
      });
    }

    return errorResponse(405, `Method ${method} not allowed`);
  } catch (err) {
    console.error('handleBillingProfile error:', err);
    const isAuthError = err.message && (err.message.includes('Unauthorized') || err.message.includes('Google Token'));
    return errorResponse(isAuthError ? 401 : 500, err.message || 'Failed to process billing profile', err);
  }
}
