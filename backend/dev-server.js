import http from 'http';
import { handler } from './src/handlers/index.js';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 4000;

/**
 * Local development server that emulates AWS API Gateway HTTP API v2 calls
 * to the Lambda handler without using Express.
 */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chunks = [];

  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const rawBody = Buffer.concat(chunks).toString('utf-8');

    // Synthesize API Gateway Event
    const pathParameters = {};
    const pdfMatch = url.pathname.match(/^\/bills\/([^/]+)\/pdf$/);
    if (pdfMatch) {
      pathParameters.id = pdfMatch[1];
    } else {
      const billMatch = url.pathname.match(/^\/bills\/([^/]+)$/);
      if (billMatch && billMatch[1] !== 'next-number' && billMatch[1] !== 'preview') {
        pathParameters.id = billMatch[1];
      }
    }
    const clientMatch = url.pathname.match(/^\/clients\/([^/]+)$/);
    if (clientMatch) {
      pathParameters.id = clientMatch[1];
    }

    const event = {
      rawPath: url.pathname,
      path: url.pathname,
      httpMethod: req.method,
      requestContext: {
        http: {
          method: req.method,
          path: url.pathname,
        },
      },
      headers: req.headers,
      queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      pathParameters,
      body: rawBody || null,
    };

    try {
      const result = await handler(event, {});

      res.writeHead(result.statusCode || 200, result.headers || {});
      if (result.isBase64Encoded) {
        res.end(Buffer.from(result.body, 'base64'));
      } else {
        res.end(result.body || '');
      }
    } catch (err) {
      console.error('Local Gateway Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Serverless Lambda Dev Runner listening on http://localhost:${PORT}`);
  console.log(`Routes available: /auth, /billing-profile, /clients, /bills, /bills/preview, /health`);
});
