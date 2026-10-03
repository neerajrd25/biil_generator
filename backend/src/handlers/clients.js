import { jsonResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';
import { connectToDatabase } from '../config/db.js';
import { buildClientDashboard, buildClientList } from '../services/clientService.js';
import { isValidEmail, normalizeEmail } from '../services/invoiceService.js';
import { ObjectId } from 'mongodb';

export async function handleClients(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const user = await verifyGoogleTokenAndGetUser(authHeader);
    const { db } = await connectToDatabase();
    const collection = db.collection('clients');

    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

    const rawPath = event.rawPath || event.path || '';

    if (method === 'GET') {
      const bills = await db.collection('bills').find({ userId: user.userId }).toArray();
      const savedClients = await collection.find({ userId: user.userId }).toArray();

      // GET /clients/dashboard?email=... -> financial dashboard for one client
      if (rawPath.endsWith('/dashboard')) {
        const email = event.queryStringParameters?.email;
        if (email === undefined || email === '') {
          return errorResponse(400, 'Client email is required');
        }
        const dashboard = buildClientDashboard(email, bills, savedClients);
        if (!dashboard) {
          return errorResponse(404, 'Client not found');
        }
        return jsonResponse(200, { success: true, ...dashboard });
      }

      // GET /clients -> every client with their money totals
      return jsonResponse(200, { success: true, ...buildClientList(bills, savedClients) });
    }

    if (method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      if (!body.clientName) {
        return errorResponse(400, 'Client name is required');
      }
      const clientEmail = normalizeEmail(body.clientEmail);
      if (!isValidEmail(clientEmail)) {
        return errorResponse(400, 'A valid client email is required');
      }
      if (await collection.findOne({ userId: user.userId, clientEmail })) {
        return errorResponse(409, 'A client with this email already exists');
      }

      const clientDoc = {
        userId: user.userId,
        clientName: body.clientName,
        clientEmail,
        clientContact: body.clientContact || '',
        clientAddress: body.clientAddress || '',
        clientCity: body.clientCity || '',
        clientState: body.clientState || '',
        clientPin: body.clientPin || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let result;
      try {
        result = await collection.insertOne(clientDoc);
      } catch (err) {
        if (err?.code === 11000) return errorResponse(409, 'A client with this email already exists');
        throw err;
      }
      return jsonResponse(201, {
        success: true,
        message: 'Client created successfully',
        client: { ...clientDoc, _id: result.insertedId },
      });
    }

    if (method === 'DELETE') {
      let clientId = event.pathParameters?.id || event.queryStringParameters?.id;
      if (!clientId && rawPath) {
        const match = rawPath.match(/\/clients\/([^/]+)/);
        if (match) clientId = match[1];
      }

      if (!clientId) {
        return errorResponse(400, 'Client id is required');
      }

      if (!ObjectId.isValid(clientId)) {
        return errorResponse(400, 'Invalid Client ID format');
      }

      await collection.deleteOne({ _id: new ObjectId(clientId), userId: user.userId });
      return jsonResponse(200, { success: true, message: 'Client deleted' });
    }

    return errorResponse(405, `Method ${method} not allowed`);
  } catch (err) {
    console.error('handleClients error:', err);
    const isAuthError = err.message && (err.message.includes('Unauthorized') || err.message.includes('Google Token'));
    return errorResponse(isAuthError ? 401 : 500, err.message || 'Failed to process clients', err);
  }
}
