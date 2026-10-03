const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export function jsonResponse(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...DEFAULT_CORS_HEADERS,
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}

export function binaryResponse(statusCode, buffer, contentType = 'application/pdf', filename = 'invoice.pdf') {
  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      ...DEFAULT_CORS_HEADERS,
    },
    isBase64Encoded: true,
    body: buffer.toString('base64'),
  };
}

export function errorResponse(statusCode, message, error = null) {
  return jsonResponse(statusCode, {
    success: false,
    message,
    error: error ? (error.message || String(error)) : undefined,
  });
}
