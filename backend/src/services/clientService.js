import {
  PAYMENT_STATUS,
  derivePaymentStatus,
  getAmountPaid,
  getBalanceDue,
  daysOverdue,
  normalizeEmail,
  presentBill,
  round2,
  todayString,
} from './invoiceService.js';

// Bills saved before client email became mandatory are grouped under this key.
export const UNASSIGNED_KEY = 'unassigned';

const emptyTotals = () => ({
  invoiceCount: 0,
  voidedCount: 0,
  billed: 0,
  paid: 0,
  outstanding: 0,
  overdue: 0,
  overdueCount: 0,
  aging: { current: 0, days1to30: 0, days31to60: 0, days60plus: 0 },
});

export function clientKeyOf(bill) {
  return normalizeEmail(bill.billTo?.clientEmail) || UNASSIGNED_KEY;
}

/** Adds one bill into a per-currency totals bucket. Void invoices never count as billed money. */
function addToTotals(totals, bill, today) {
  if (bill.status === PAYMENT_STATUS.VOID) {
    totals.voidedCount += 1;
    return;
  }
  const balance = getBalanceDue(bill);
  const late = daysOverdue(bill, today);

  totals.invoiceCount += 1;
  totals.billed += Number(bill.total) || 0;
  totals.paid += getAmountPaid(bill);
  totals.outstanding += balance;

  if (balance > 0) {
    if (late === 0) totals.aging.current += balance;
    else if (late <= 30) totals.aging.days1to30 += balance;
    else if (late <= 60) totals.aging.days31to60 += balance;
    else totals.aging.days60plus += balance;
  }
  if (late > 0) {
    totals.overdue += balance;
    totals.overdueCount += 1;
  }
}

function roundTotals(totals) {
  return {
    ...totals,
    billed: round2(totals.billed),
    paid: round2(totals.paid),
    outstanding: round2(totals.outstanding),
    overdue: round2(totals.overdue),
    aging: Object.fromEntries(Object.entries(totals.aging).map(([k, v]) => [k, round2(v)])),
  };
}

/** Money is never summed across currencies - totals are always keyed by currency code. */
export function summarizeBills(bills, today = todayString()) {
  const byCurrency = {};
  for (const bill of bills) {
    const currency = bill.currency || 'USD';
    byCurrency[currency] ||= emptyTotals();
    addToTotals(byCurrency[currency], bill, today);
  }
  // A currency that only has void invoices carries no money, so it is left out.
  return Object.fromEntries(
    Object.entries(byCurrency)
      .filter(([, t]) => t.invoiceCount > 0)
      .map(([c, t]) => [c, roundTotals(t)])
  );
}

const CLIENT_FIELDS = ['clientName', 'clientContact', 'clientAddress', 'clientCity', 'clientState', 'clientPin'];

function pickClientFields(source = {}) {
  return Object.fromEntries(CLIENT_FIELDS.map((f) => [f, source[f] || '']));
}

const byNewest = (a, b) =>
  String(b.billDate || '').localeCompare(String(a.billDate || '')) ||
  new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

function groupByClient(bills) {
  const groups = new Map();
  for (const bill of bills) {
    const key = clientKeyOf(bill);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bill);
  }
  return groups;
}

function describeClient(key, clientBills, saved) {
  const latest = [...clientBills].sort(byNewest)[0];
  const isUnassigned = key === UNASSIGNED_KEY;
  return {
    ...pickClientFields(latest?.billTo),
    ...(saved ? { ...pickClientFields(saved), _id: saved._id, createdAt: saved.createdAt } : {}),
    clientName: saved?.clientName || latest?.billTo?.clientName || (isUnassigned ? 'No email on file' : key),
    clientEmail: isUnassigned ? '' : key,
    key,
    isUnassigned,
  };
}

/** Every known client (saved or inferred from invoices) with their money totals. */
export function buildClientList(bills, savedClients = [], today = todayString()) {
  const groups = groupByClient(bills);
  const savedByEmail = new Map(savedClients.map((c) => [normalizeEmail(c.clientEmail), c]));
  const keys = new Set([...groups.keys(), ...savedByEmail.keys()].filter(Boolean));

  const clients = [...keys].map((key) => {
    const clientBills = groups.get(key) || [];
    const latest = [...clientBills].sort(byNewest)[0];
    return {
      ...describeClient(key, clientBills, savedByEmail.get(key)),
      totalsByCurrency: summarizeBills(clientBills, today),
      invoiceCount: clientBills.filter((b) => b.status !== PAYMENT_STATUS.VOID).length,
      lastInvoiceDate: latest?.billDate || null,
    };
  });

  clients.sort((a, b) => {
    if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
    return a.clientName.localeCompare(b.clientName, undefined, { sensitivity: 'base' });
  });

  return {
    clients,
    summary: {
      clientCount: clients.filter((c) => !c.isUnassigned).length,
      totalsByCurrency: summarizeBills(bills, today),
    },
  };
}

function monthlyTrend(bills, monthsBack = 12, now = new Date()) {
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }

  const trend = {};
  for (const bill of bills) {
    if (bill.status === PAYMENT_STATUS.VOID) continue;
    const month = String(bill.billDate || '').slice(0, 7);
    if (!months.includes(month)) continue;
    const currency = bill.currency || 'USD';
    trend[currency] ||= Object.fromEntries(months.map((m) => [m, { month: m, billed: 0, paid: 0 }]));
    trend[currency][month].billed += Number(bill.total) || 0;
    trend[currency][month].paid += getAmountPaid(bill);
  }

  return Object.fromEntries(
    Object.entries(trend).map(([currency, byMonth]) => [
      currency,
      Object.values(byMonth).map((m) => ({ ...m, billed: round2(m.billed), paid: round2(m.paid) })),
    ])
  );
}

/** Returns null when the client is unknown (no invoices and not saved). */
export function buildClientDashboard(key, bills, savedClients = [], today = todayString()) {
  const normalizedKey = key === UNASSIGNED_KEY ? key : normalizeEmail(key);
  const clientBills = bills.filter((b) => clientKeyOf(b) === normalizedKey);
  const saved = savedClients.find((c) => normalizeEmail(c.clientEmail) === normalizedKey);

  if (clientBills.length === 0 && !saved) return null;

  const statusCounts = { PAID: 0, PARTIALLY_PAID: 0, UNPAID: 0, OVERDUE: 0, VOID: 0 };
  for (const bill of clientBills) {
    const status = derivePaymentStatus(bill);
    statusCounts[status] += 1;
    if (daysOverdue(bill, today) > 0) statusCounts.OVERDUE += 1;
  }

  return {
    client: describeClient(normalizedKey, clientBills, saved),
    totalsByCurrency: summarizeBills(clientBills, today),
    monthlyByCurrency: monthlyTrend(clientBills, 12, new Date(`${today}T00:00:00Z`)),
    statusCounts,
    invoices: [...clientBills].sort(byNewest).map((b) => presentBill(b, today)),
  };
}

/** Creates/refreshes the saved client record for a bill's recipient, keyed by email. */
export async function upsertClientFromBill(db, userId, billTo) {
  const clientEmail = normalizeEmail(billTo.clientEmail);
  if (!clientEmail) return;
  const now = new Date();
  try {
    await db.collection('clients').updateOne(
      { userId, clientEmail },
      {
        $set: { ...pickClientFields(billTo), updatedAt: now },
        $setOnInsert: { userId, clientEmail, createdAt: now },
      },
      { upsert: true }
    );
  } catch (err) {
    // A concurrent save for the same email may hit the unique index; the record exists either way.
    if (err?.code !== 11000) throw err;
  }
}
