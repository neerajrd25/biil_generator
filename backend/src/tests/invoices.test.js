import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  buildInvoiceContent,
  buildPaymentUpdate,
  derivePaymentStatus,
  getAmountPaid,
  getBalanceDue,
  presentBill,
} from '../services/invoiceService.js';
import { UNASSIGNED_KEY, buildClientDashboard, buildClientList, summarizeBills } from '../services/clientService.js';

const TODAY = '2026-10-03';
const user = { name: 'Me', email: 'me@example.com' };

const bill = (overrides = {}) => ({
  invoiceNumber: 'NV001',
  billDate: '2026-09-01',
  dueDate: '2026-09-15',
  currency: 'USD',
  total: 100,
  status: 'UNPAID',
  billTo: { clientName: 'Acme', clientEmail: 'billing@acme.com' },
  ...overrides,
});

test('payment status is derived from amount received', () => {
  assert.equal(derivePaymentStatus(bill()), 'UNPAID');
  assert.equal(derivePaymentStatus(bill({ amountPaid: 40 })), 'PARTIALLY_PAID');
  assert.equal(derivePaymentStatus(bill({ amountPaid: 100 })), 'PAID');
  assert.equal(derivePaymentStatus(bill({ status: 'VOID', amountPaid: 0 })), 'VOID');
});

test('legacy invoices marked PAID without amountPaid count as fully paid', () => {
  const legacy = bill({ status: 'PAID' });
  assert.equal(getAmountPaid(legacy), 100);
  assert.equal(getBalanceDue(legacy), 0);
});

test('void invoices owe nothing', () => {
  assert.equal(getBalanceDue(bill({ status: 'VOID' })), 0);
});

test('presentBill flags overdue invoices only while a balance remains', () => {
  assert.equal(presentBill(bill(), TODAY).isOverdue, true);
  assert.equal(presentBill(bill(), TODAY).daysOverdue, 18);
  assert.equal(presentBill(bill({ amountPaid: 100 }), TODAY).isOverdue, false);
  assert.equal(presentBill(bill({ dueDate: '2026-10-03' }), TODAY).isOverdue, false);
  assert.equal(presentBill(bill({ dueDate: '' }), TODAY).isOverdue, false);
  assert.equal(presentBill(bill()).isLocked, false);
});

test('buildPaymentUpdate validates and derives status', () => {
  assert.deepEqual(
    (({ amountPaid, status }) => ({ amountPaid, status }))(buildPaymentUpdate(bill(), 100)),
    { amountPaid: 100, status: 'PAID' }
  );
  assert.equal(buildPaymentUpdate(bill(), 25.5).status, 'PARTIALLY_PAID');
  assert.equal(buildPaymentUpdate(bill({ amountPaid: 50 }), 0).status, 'UNPAID');
  assert.throws(() => buildPaymentUpdate(bill(), 101), ValidationError);
  assert.throws(() => buildPaymentUpdate(bill(), -1), ValidationError);
  assert.throws(() => buildPaymentUpdate(bill(), 'abc'), ValidationError);
});

test('buildInvoiceContent requires a valid client email and normalises it', () => {
  const base = { lineItems: [{ name: 'Work', quantity: 2, price: 50 }], billTo: { clientName: 'Acme' } };
  assert.throws(() => buildInvoiceContent(base, user), /email is required/);
  assert.throws(() => buildInvoiceContent({ ...base, billTo: { clientEmail: 'nope' } }, user), /valid email/);
  assert.throws(() => buildInvoiceContent({ ...base, lineItems: [], billTo: { clientEmail: 'a@b.co' } }, user), /line item/);
  assert.throws(() => buildInvoiceContent({ ...base, billTo: { clientEmail: 'a@b.co' }, billDate: '03/10/2026' }, user), /YYYY-MM-DD/);

  const content = buildInvoiceContent({ ...base, billTo: { clientName: 'Acme', clientEmail: '  Billing@ACME.com ' }, taxRate: 10 }, user);
  assert.equal(content.billTo.clientEmail, 'billing@acme.com');
  assert.equal(content.total, 110);
  assert.equal(content.billFrom.vendorName, 'Me');
});

test('summarizeBills keeps currencies apart and ignores void invoices', () => {
  const totals = summarizeBills(
    [
      bill({ total: 100, amountPaid: 40 }),
      bill({ total: 50, dueDate: '2026-12-01' }),
      bill({ total: 999, status: 'VOID' }),
      bill({ total: 200, currency: 'INR', amountPaid: 200 }),
    ],
    TODAY
  );
  assert.equal(totals.USD.billed, 150);
  assert.equal(totals.USD.paid, 40);
  assert.equal(totals.USD.outstanding, 110);
  assert.equal(totals.USD.overdue, 60);
  assert.equal(totals.USD.overdueCount, 1);
  assert.equal(totals.USD.voidedCount, 1);
  assert.equal(totals.USD.aging.days1to30, 60);
  assert.equal(totals.USD.aging.current, 50);
  assert.equal(totals.INR.outstanding, 0);
});

test('aging buckets split by days overdue', () => {
  const totals = summarizeBills(
    [
      bill({ dueDate: '2026-09-20' }),
      bill({ dueDate: '2026-08-20' }),
      bill({ dueDate: '2026-06-01' }),
    ],
    TODAY
  );
  assert.deepEqual(totals.USD.aging, { current: 0, days1to30: 100, days31to60: 100, days60plus: 100 });
});

test('clients are identified by email regardless of case or name', () => {
  const { clients, summary } = buildClientList(
    [
      bill({ billTo: { clientName: 'Acme Inc', clientEmail: 'Billing@Acme.com' } }),
      bill({ billTo: { clientName: 'ACME', clientEmail: 'billing@acme.com ' }, billDate: '2026-09-20' }),
      bill({ billTo: { clientName: 'Other', clientEmail: 'hi@other.io' } }),
    ],
    [],
    TODAY
  );
  assert.equal(clients.length, 2);
  assert.equal(summary.clientCount, 2);
  const acme = clients.find((c) => c.clientEmail === 'billing@acme.com');
  assert.equal(acme.invoiceCount, 2);
  assert.equal(acme.clientName, 'ACME');
  assert.equal(acme.totalsByCurrency.USD.billed, 200);
});

test('saved clients without invoices are listed; bills without email are grouped as unassigned', () => {
  const { clients, summary } = buildClientList(
    [bill({ billTo: { clientName: 'Legacy' } })],
    [{ _id: 'c1', clientName: 'New Co', clientEmail: 'NEW@co.com' }],
    TODAY
  );
  assert.deepEqual(clients.map((c) => c.clientName), ['New Co', 'Legacy']);
  assert.equal(clients[0]._id, 'c1');
  assert.equal(clients[1].isUnassigned, true);
  assert.equal(clients[1].clientEmail, '');
  assert.equal(summary.clientCount, 1);
});

test('client dashboard covers one client with trend, status counts and invoices', () => {
  const bills = [
    bill({ total: 100, amountPaid: 100, billDate: '2026-10-01' }),
    bill({ total: 300, billDate: '2026-09-01', dueDate: '2026-09-15' }),
    bill({ total: 50, status: 'VOID' }),
    bill({ billTo: { clientName: 'Other', clientEmail: 'x@y.com' } }),
  ];
  const dash = buildClientDashboard('BILLING@acme.com', bills, [], TODAY);
  assert.equal(dash.invoices.length, 3);
  assert.deepEqual(dash.statusCounts, { PAID: 1, PARTIALLY_PAID: 0, UNPAID: 1, OVERDUE: 1, VOID: 1 });
  assert.equal(dash.totalsByCurrency.USD.billed, 400);
  assert.equal(dash.totalsByCurrency.USD.outstanding, 300);

  const months = dash.monthlyByCurrency.USD;
  assert.equal(months.length, 12);
  assert.equal(months.at(-1).month, '2026-10');
  assert.deepEqual(months.at(-1), { month: '2026-10', billed: 100, paid: 100 });
  assert.deepEqual(months.at(-2), { month: '2026-09', billed: 300, paid: 0 });

  assert.equal(buildClientDashboard('nobody@x.com', bills, [], TODAY), null);
  assert.equal(buildClientDashboard(UNASSIGNED_KEY, bills, [], TODAY), null);
});
