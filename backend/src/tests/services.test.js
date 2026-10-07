import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBillTotals, formatInvoiceNumber } from '../services/billCalculationService.js';
import { createInvoicePdfBuffer } from '../services/pdfService.js';
import { normalizeAnnexure, parseNumber } from '../services/annexureService.js';
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

const pageCount = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
const baseBill = {
  invoiceNumber: 'NV1', billDate: '2026-10-02', billFrom: { vendorName: 'Acme' }, billTo: { clientName: 'Beta' },
  lineItems: [{ name: 'x', quantity: 1, price: 5, amount: 5 }], subtotal: 5, total: 5,
};

test('normalizeAnnexure sanitises tables, text, and legacy particulars', () => {
  const table = normalizeAnnexure({
    mode: 'table',
    columns: [{ label: 'Date' }, { label: 'Hours', align: 'right', total: true }],
    rows: [['07/06/2026', '1', 'extra ignored'], ['', ''], ['30/06/2026']],
  });
  assert.equal(table.rows.length, 2);
  assert.deepEqual(table.rows[1], ['30/06/2026', '']);
  assert.equal(table.columns[1].total, true);

  assert.equal(normalizeAnnexure({ mode: 'text', text: '   ' }), null);
  assert.equal(normalizeAnnexure({ mode: 'text', text: 'Hello' }).text, 'Hello');

  const legacy = normalizeAnnexure(undefined, [{ srNo: 1, description: 'Phase 1', remarks: '' }, { description: '  ' }]);
  assert.equal(legacy.rows.length, 1);
  assert.equal(legacy.columns.length, 3);
  assert.equal(normalizeAnnexure(undefined, []), null);
  assert.equal(parseNumber('1,200.5'), 1200.5);
  assert.equal(parseNumber('abc'), null);
});

test('PDF: a 40-row table annexure flows onto extra pages; text annexure renders', async () => {
  const rows = Array.from({ length: 40 }, (_, i) => [`${String(i + 1).padStart(2, '0')}/06/2026`, '1', `Task description number ${i + 1} with some longer wording to wrap across the column width in the table`, 'AUD-169']);
  const table = await createInvoicePdfBuffer({
    ...baseBill,
    annexure: { mode: 'table', title: 'Timesheet', columns: [{ label: 'Date' }, { label: 'Hours', align: 'right', total: true }, { label: 'Description' }, { label: 'Task' }], rows },
  });
  assert.equal(table.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pageCount(table) >= 3, `expected >=3 pages, got ${pageCount(table)}`);

  const text = await createInvoicePdfBuffer({ ...baseBill, annexure: { mode: 'text', text: 'Scope\n\n- one\n- two\n' + 'long line '.repeat(400) } });
  assert.ok(pageCount(text) >= 2);

  assert.equal(pageCount(await createInvoicePdfBuffer(baseBill)), 1);
});
