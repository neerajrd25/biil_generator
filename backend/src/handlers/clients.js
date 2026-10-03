import { jsonResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';
import { connectToDatabase } from '../config/db.js';
import { ObjectId } from 'mongodb';

export async function handleClients(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const user = await verifyGoogleTokenAndGetUser(authHeader);
    const { db } = await connectToDatabase();
    const collection = db.collection('clients');

    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

    if (method === 'GET') {
      const clients = await collection.find({ userId: user.userId }).sort({ clientName: 1 }).toArray();
      return jsonResponse(200, {
        success: true,
        clients,
      });
    }

    if (method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      if (!body.clientName) {
        return errorResponse(400, 'Client name is required');
      }

      const clientDoc = {
        userId: user.userId,
        clientName: body.clientName,
        clientEmail: body.clientEmail || '',
        clientContact: body.clientContact || '',
        clientAddress: body.clientAddress || '',
        clientCity: body.clientCity || '',
        clientState: body.clientState || '',
        clientPin: body.clientPin || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await collection.insertOne(clientDoc);
      return jsonResponse(201, {
        success: true,
        message: 'Client created successfully',
        client: { ...clientDoc, _id: result.insertedId },
      });
    }

    if (method === 'DELETE') {
      const rawPath = event.rawPath || event.path || '';
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
