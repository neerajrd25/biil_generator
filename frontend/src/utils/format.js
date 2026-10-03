export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($ - USD)', symbol: '$' },
  { code: 'INR', label: 'Indian Rupee (₹ - INR)', symbol: '₹' },
  { code: 'EUR', label: 'Euro (€ - EUR)', symbol: '€' },
  { code: 'GBP', label: 'British Pound (£ - GBP)', symbol: '£' },
  { code: 'CAD', label: 'Canadian Dollar (CA$ - CAD)', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar (AU$ - AUD)', symbol: 'AU$' },
  { code: 'AED', label: 'UAE Dirham (AED)', symbol: 'AED' },
];

export function formatMoney(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export const STATUS_META = {
  PAID: { label: 'Paid', color: 'success' },
  PARTIALLY_PAID: { label: 'Partially paid', color: 'info' },
  UNPAID: { label: 'Unpaid', color: 'default' },
  OVERDUE: { label: 'Overdue', color: 'error' },
  VOID: { label: 'Void', color: 'default' },
};

/** Overdue wins over unpaid/partially paid so late invoices stand out. */
export function getDisplayStatus(bill) {
  if (bill.paymentStatus === 'VOID') return 'VOID';
  if (bill.isOverdue) return 'OVERDUE';
  return bill.paymentStatus || 'UNPAID';
}

export const clientPath = (client) => `/clients/${encodeURIComponent(client.isUnassigned ? 'unassigned' : client.clientEmail)}`;

export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;
