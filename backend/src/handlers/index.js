import { handleAuth } from './auth.js';
import { handleBillingProfile } from './billingProfile.js';
import { handleClients } from './clients.js';
import { handleBills } from './bills.js';
import { handlePdf } from './pdf.js';
import { jsonResponse } from '../middleware/response.js';

/**
 * Unified AWS Lambda Entrypoint Router.
 * Supports API Gateway HTTP API v2 ($default payload) as well as REST API v1 events.
 * Zero Express JS dependencies.
 */
export async function handler(event, context) {
  // Allow Lambda to freeze background pool connections properly
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  const method = (event.httpMethod || event.requestContext?.http?.method || 'GET').toUpperCase();
  const rawPath = event.rawPath || event.path || '';

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      },
    };
  }

  // Health check
  if (rawPath === '/health' || rawPath === '/') {
    return jsonResponse(200, {
      status: 'healthy',
      service: 'bill-generator-lambda-backend',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    });
  }

  // Route: /auth
  if (rawPath.startsWith('/auth')) {
    return handleAuth(event);
  }

  // Route: /billing-profile
  if (rawPath.startsWith('/billing-profile')) {
    return handleBillingProfile(event);
  }

  // Route: /clients
  if (rawPath.startsWith('/clients')) {
    return handleClients(event);
  }

  // Route: /bills/preview or /bills/:id/pdf
  if (rawPath.endsWith('/preview') || rawPath.endsWith('/pdf')) {
    return handlePdf(event);
  }

  // Route: /bills
  if (rawPath.startsWith('/bills')) {
    return handleBills(event);
  }

  return jsonResponse(404, {
    success: false,
    message: `Route not found: ${method} ${rawPath}`,
  });
}
