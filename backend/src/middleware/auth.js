import { OAuth2Client } from 'google-auth-library';
import { connectToDatabase } from '../config/db.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleTokenAndGetUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or malformed Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  let payload;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    // If running in development without configured Google Client ID, allow dev bypass if explicitly set
    if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
      payload = {
        sub: 'dev-google-user-12345',
        email: 'dev@example.com',
        name: 'Dev User',
        picture: '',
      };
    } else {
      throw new Error(`Invalid Google Token: ${err.message}`);
    }
  }

  const { sub: googleId, email, name, picture } = payload;
  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  const now = new Date();
  const result = await usersCollection.findOneAndUpdate(
    { googleId },
    {
      $set: {
        email,
        name,
        picture,
        updatedAt: now,
      },
      $setOnInsert: {
        googleId,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const user = result.value || result;
  return {
    userId: user._id.toString(),
    googleId,
    email,
    name,
    picture,
  };
}
