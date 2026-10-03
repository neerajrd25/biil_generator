import { jsonResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';
import { connectToDatabase } from '../config/db.js';
import { sanitizeLogo } from '../services/brandingService.js';
import { ValidationError, sanitizeWebsite } from '../services/invoiceService.js';

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
          vendorWebsite: '',
          vendorWebsite2: '',
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
        vendorWebsite: sanitizeWebsite(body.vendorWebsite),
        vendorWebsite2: sanitizeWebsite(body.vendorWebsite2),
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

      // logo: undefined keeps the stored one, null removes it, an object replaces it.
      const update = { $set: profileData, $setOnInsert: { userId: user.userId, createdAt: now } };
      if (body.logo === null) {
        update.$unset = { logo: '' };
      } else if (body.logo !== undefined) {
        profileData.logo = sanitizeLogo(body.logo);
      }

      const result = await collection.findOneAndUpdate(
        { userId: user.userId },
        update,
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
    if (err instanceof ValidationError) {
      return errorResponse(400, err.message);
    }
    console.error('handleBillingProfile error:', err);
    const isAuthError = err.message && (err.message.includes('Unauthorized') || err.message.includes('Google Token'));
    return errorResponse(isAuthError ? 401 : 500, err.message || 'Failed to process billing profile', err);
  }
}
