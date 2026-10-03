import { jsonResponse, errorResponse } from '../middleware/response.js';
import { verifyGoogleTokenAndGetUser } from '../middleware/auth.js';

export async function handleAuth(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const user = await verifyGoogleTokenAndGetUser(authHeader);

    return jsonResponse(200, {
      success: true,
      message: 'Authentication successful',
      user,
    });
  } catch (err) {
    console.error('handleAuth error:', err);
    return errorResponse(401, 'Authentication failed', err);
  }
}
