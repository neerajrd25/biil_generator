import { connectToDatabase } from '../config/db.js';
import { ValidationError } from './invoiceService.js';

export const MAX_LOGO_BYTES = 1024 * 1024;

// Only formats PDFKit can embed; the first bytes are checked so a renamed file can't break PDF generation.
const SIGNATURES = {
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
};

/** Validates an uploaded logo `{ mimeType, data(base64) }` and returns the value to store. */
export function sanitizeLogo(logo) {
  const mimeType = String(logo?.mimeType || '').toLowerCase();
  const signature = SIGNATURES[mimeType];
  if (!signature) {
    throw new ValidationError('Logo must be a PNG or JPEG image');
  }
  const data = String(logo.data || '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) {
    throw new ValidationError('Logo image data is not valid');
  }
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_LOGO_BYTES) {
    throw new ValidationError('Logo is too large (max 1 MB)');
  }
  if (!signature.every((byte, i) => buffer[i] === byte)) {
    throw new ValidationError('Logo file content does not match its image type');
  }
  return { mimeType, data };
}

/** The user's saved logo as a Buffer, or null when none is set. */
export async function getLogoBuffer(userId) {
  const { db } = await connectToDatabase();
  const profile = await db.collection('billing_profiles').findOne({ userId }, { projection: { logo: 1 } });
  return profile?.logo?.data ? Buffer.from(profile.logo.data, 'base64') : null;
}
