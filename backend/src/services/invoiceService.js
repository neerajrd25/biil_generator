import { calculateBillTotals } from './billCalculationService.js';

export const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOID: 'VOID',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const round2 = (n) => Number((Number(n) || 0).toFixed(2));

export const sanitizeWebsite = (value) => String(value ?? '').trim().slice(0, 200);

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const isValidEmail = (email) => EMAIL_PATTERN.test(normalizeEmail(email));

export const isValidDateString = (value) => DATE_PATTERN.test(String(value || '')) && !Number.isNaN(Date.parse(value));

export const todayString = () => new Date().toISOString().slice(0, 10);

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Amount received against an invoice. Invoices created before payment tracking
 * existed only carry status 'PAID', so that is treated as "fully paid".
 */
export function getAmountPaid(bill) {
  const total = Number(bill.total) || 0;
  if (typeof bill.amountPaid === 'number') {
    return round2(Math.min(Math.max(bill.amountPaid, 0), total));
  }
  return bill.status === PAYMENT_STATUS.PAID ? round2(total) : 0;
}

export function derivePaymentStatus(bill) {
  if (bill.status === PAYMENT_STATUS.VOID) return PAYMENT_STATUS.VOID;
  const total = Number(bill.total) || 0;
  const paid = getAmountPaid(bill);
  if (total > 0 && paid >= total) return PAYMENT_STATUS.PAID;
  if (paid > 0) return PAYMENT_STATUS.PARTIALLY_PAID;
  return PAYMENT_STATUS.UNPAID;
}

export function getBalanceDue(bill) {
  if (bill.status === PAYMENT_STATUS.VOID) return 0;
  return round2(Math.max((Number(bill.total) || 0) - getAmountPaid(bill), 0));
}

export function daysOverdue(bill, today = todayString()) {
  if (!bill.dueDate || !DATE_PATTERN.test(bill.dueDate) || getBalanceDue(bill) <= 0) return 0;
  if (bill.dueDate >= today) return 0;
  return Math.round((Date.parse(today) - Date.parse(bill.dueDate)) / 86400000);
}

/** Adds the computed (never stored) fields the UI relies on. */
export function presentBill(bill, today = todayString()) {
  const overdueDays = daysOverdue(bill, today);
  return {
    ...bill,
    isLocked: bill.isLocked === true,
    amountPaid: getAmountPaid(bill),
    balanceDue: getBalanceDue(bill),
    paymentStatus: derivePaymentStatus(bill),
    isOverdue: overdueDays > 0,
    daysOverdue: overdueDays,
  };
}

/** Records the total amount received so far and keeps the stored status in sync. */
export function buildPaymentUpdate(bill, amountPaid) {
  const amount = Number(amountPaid);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationError('Amount received must be zero or more');
  }
  const total = Number(bill.total) || 0;
  if (round2(amount) > total) {
    throw new ValidationError(`Amount received cannot exceed the invoice total (${total.toFixed(2)})`);
  }
  const next = { ...bill, amountPaid: round2(amount) };
  const status = derivePaymentStatus({ ...next, status: undefined });
  return {
    amountPaid: next.amountPaid,
    status,
    paidAt: next.amountPaid > 0 ? new Date() : null,
  };
}

const str = (value) => String(value ?? '').trim();

/**
 * Validates and normalises the editable content of an invoice. Shared by create and edit
 * so both paths enforce the same rules.
 */
export function buildInvoiceContent(body, user) {
  const { lineItems, taxRate = 0, billFrom = {}, billTo = {}, accountDetail = {}, particulars = [] } = body;

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new ValidationError('At least one line item is required');
  }

  const clientEmail = normalizeEmail(billTo.clientEmail);
  if (!clientEmail) {
    throw new ValidationError('Client email is required - it is used to identify the client');
  }
  if (!isValidEmail(clientEmail)) {
    throw new ValidationError('Client email is not a valid email address');
  }

  const billDate = body.billDate || todayString();
  if (!isValidDateString(billDate)) {
    throw new ValidationError('Invoice date must be in YYYY-MM-DD format');
  }
  const dueDate = body.dueDate || '';
  if (dueDate && !isValidDateString(dueDate)) {
    throw new ValidationError('Due date must be in YYYY-MM-DD format');
  }

  const calculated = calculateBillTotals(lineItems, taxRate);

  const sanitizedParticulars = Array.isArray(particulars)
    ? particulars
        .filter((p) => p && str(p.description) !== '')
        .map((p, idx) => ({
          srNo: p.srNo || idx + 1,
          description: str(p.description),
          remarks: str(p.remarks),
        }))
    : [];

  return {
    billDate,
    dueDate,
    currency: body.currency || 'USD',
    billFrom: {
      vendorName: billFrom.vendorName || user.name,
      vendorEmail: billFrom.vendorEmail || user.email,
      vendorContact: billFrom.vendorContact || '',
      vendorAddress: billFrom.vendorAddress || '',
      vendorCity: billFrom.vendorCity || '',
      vendorState: billFrom.vendorState || '',
      vendorPin: billFrom.vendorPin || '',
      vendorWebsite: sanitizeWebsite(billFrom.vendorWebsite),
      vendorWebsite2: sanitizeWebsite(billFrom.vendorWebsite2),
      taxId: billFrom.taxId || '',
    },
    billTo: {
      clientName: str(billTo.clientName) || 'Valued Client',
      clientEmail,
      clientContact: billTo.clientContact || '',
      clientAddress: billTo.clientAddress || '',
      clientCity: billTo.clientCity || '',
      clientState: billTo.clientState || '',
      clientPin: billTo.clientPin || '',
    },
    lineItems: calculated.lineItems,
    particulars: sanitizedParticulars,
    subtotal: calculated.subtotal,
    taxRate: calculated.taxRate,
    taxAmount: calculated.taxAmount,
    total: calculated.total,
    accountDetail: {
      bankName: accountDetail.bankName || '',
      accountHolder: accountDetail.accountHolder || '',
      accountNumber: accountDetail.accountNumber || '',
      ifscCode: accountDetail.ifscCode || '',
    },
    notes: body.notes || '',
  };
}
