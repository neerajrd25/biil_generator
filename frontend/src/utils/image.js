const MAX_BYTES = 900 * 1024;

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image file'));
    img.src = url;
  });

const toPayload = (dataUrl) => {
  const [header, data] = dataUrl.split(',');
  return { mimeType: header.match(/data:(.*);base64/)[1], data };
};

/**
 * Downscales any browser-readable image (PNG, JPEG, WebP, SVG...) to at most `maxSide` px and
 * returns `{ mimeType, data }` in a format the PDF generator supports (PNG, or JPEG if PNG is too big).
 */
export async function prepareLogo(file, maxSide = 600) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, SVG or WebP)');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const srcW = img.naturalWidth || img.width || maxSide;
    const srcH = img.naturalHeight || img.height || maxSide;
    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let result = toPayload(canvas.toDataURL('image/png'));
    if (result.data.length * 0.75 > MAX_BYTES) {
      // Transparency is lost on the JPEG fallback, so paint a white background first.
      const flat = document.createElement('canvas');
      flat.width = canvas.width;
      flat.height = canvas.height;
      const flatCtx = flat.getContext('2d');
      flatCtx.fillStyle = '#fff';
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(canvas, 0, 0);
      result = toPayload(flat.toDataURL('image/jpeg', 0.85));
    }
    if (result.data.length * 0.75 > MAX_BYTES) {
      throw new Error('This logo is too detailed to store - try a simpler or smaller image');
    }
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
