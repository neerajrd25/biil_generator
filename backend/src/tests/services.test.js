import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBillTotals, formatInvoiceNumber } from '../services/billCalculationService.js';
import { createInvoicePdfBuffer } from '../services/pdfService.js';
import { handler } from '../handlers/index.js';

test('formatInvoiceNumber generates date-based format NV20261002001', () => {
  const result = formatInvoiceNumber({
    prefix: 'NV',
    format: 'DATE_BASED',
    separator: '',
    digits: 3,
    sequence: 1,
    date: new Date('2026-10-02T10:00:00Z'),
  });
  assert.equal(result, 'NV20261002001');
});

test('formatInvoiceNumber generates sequential format with separator NV-001', () => {
  const result = formatInvoiceNumber({
    prefix: 'NV',
    format: 'SEQUENTIAL',
    separator: '-',
    digits: 3,
    sequence: 5,
  });
  assert.equal(result, 'NV-005');
});

test('formatInvoiceNumber generates sequential format without separator NV001', () => {
  const result = formatInvoiceNumber({
    prefix: 'NV',
    format: 'SEQUENTIAL',
    separator: '',
    digits: 3,
    sequence: 1,
  });
  assert.equal(result, 'NV001');
});

test('calculateBillTotals calculates line items, tax and total correctly', () => {
  const lineItems = [
    { name: 'Software Development', quantity: 10, price: 50 },
    { name: 'Code Review', quantity: 2, price: 100 },
  ];
  const taxRate = 10;

  const result = calculateBillTotals(lineItems, taxRate);

  assert.equal(result.lineItems.length, 2);
  assert.equal(result.subtotal, 700);
  assert.equal(result.taxRate, 10);
  assert.equal(result.taxAmount, 70);
  assert.equal(result.total, 770);
});

test('calculateBillTotals handles empty line items and zeroes', () => {
  const result = calculateBillTotals([], 0);
  assert.equal(result.subtotal, 0);
  assert.equal(result.taxAmount, 0);
  assert.equal(result.total, 0);
});

test('createInvoicePdfBuffer produces a non-empty valid PDF buffer with currency and particulars on page 2', async () => {
  const billData = {
    invoiceNumber: 'NV20261002001',
    billDate: '2026-10-02',
    currency: 'INR',
    billFrom: { vendorName: 'Acme Corp', vendorEmail: 'acme@example.com' },
    billTo: { clientName: 'Beta LLC', clientEmail: 'beta@example.com' },
    lineItems: [{ name: 'Consulting', quantity: 1, price: 1500, amount: 1500 }],
    subtotal: 1500,
    taxRate: 18,
    taxAmount: 270,
    total: 1770,
    notes: 'Thank you for your business.',
    particulars: [
      { srNo: 1, description: 'Phase 1 Architecture & Design', remarks: 'Completed on schedule' },
      { srNo: 2, description: 'Phase 2 Cloud API Implementation', remarks: 'Delivered' },
    ],
  };

  const buffer = await createInvoicePdfBuffer(billData);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
  // PDF header check (%PDF-)
  assert.equal(buffer.slice(0, 5).toString('ascii'), '%PDF-');
});

test('Lambda handler responds to OPTIONS CORS preflight', async () => {
  const event = {
    httpMethod: 'OPTIONS',
    rawPath: '/bills',
  };

  const response = await handler(event, {});
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['Access-Control-Allow-Origin'], '*');
});

test('Lambda handler responds to Health Check', async () => {
  const event = {
    httpMethod: 'GET',
    rawPath: '/health',
  };

  const response = await handler(event, {});
  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.equal(data.status, 'healthy');
});

test('Lambda handler handles /bills/:id/pdf route and rejects unauthorized request', async () => {
  const event = {
    httpMethod: 'GET',
    rawPath: '/bills/6ac0c9572832c55249a73301/pdf',
  };

  const response = await handler(event, {});
  assert.equal(response.statusCode, 401);
});

test('Lambda handler extracts ID from path and validates ObjectId format', async () => {
  const event = {
    httpMethod: 'GET',
    rawPath: '/bills/not-a-valid-id/pdf',
    headers: {
      Authorization: 'Bearer mock-dev-token',
    },
  };
  process.env.DEV_BYPASS_AUTH = 'true';
  process.env.NODE_ENV = 'development';

  const response = await handler(event, {});
  assert.equal(response.statusCode, 400);
  const data = JSON.parse(response.body);
  assert.equal(data.message, 'Invalid Bill ID format');
});
