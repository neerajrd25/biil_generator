import { connectToDatabase } from '../config/db.js';

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', pdfSymbol: '$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', pdfSymbol: 'Rs. ' },
  { code: 'EUR', name: 'Euro', symbol: '€', pdfSymbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£', pdfSymbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', pdfSymbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$', pdfSymbol: 'AU$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', pdfSymbol: 'AED ' },
];

export function getCurrencyDetails(currencyInput) {
  if (!currencyInput) {
    return { code: 'USD', symbol: '$', pdfSymbol: '$' };
  }
  if (typeof currencyInput === 'object' && currencyInput.code) {
    const match = SUPPORTED_CURRENCIES.find(c => c.code === currencyInput.code);
    return match || {
      code: currencyInput.code,
      symbol: currencyInput.symbol || currencyInput.code,
      pdfSymbol: currencyInput.pdfSymbol || currencyInput.symbol || currencyInput.code,
    };
  }
  const match = SUPPORTED_CURRENCIES.find(c => c.code === String(currencyInput).toUpperCase());
  return match || { code: String(currencyInput), symbol: String(currencyInput), pdfSymbol: String(currencyInput) };
}

export function formatInvoiceNumber({
  prefix = 'NV',
  format = 'DATE_BASED',
  separator = '',
  digits = 3,
  sequence = 1,
  date = new Date(),
}) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const numDigits = Math.max(1, Number(digits) || 3);
  const seqStr = String(sequence).padStart(numDigits, '0');
  const cleanPrefix = (prefix || 'NV').trim();
  const sep = separator || '';

  if (format === 'DATE_BASED') {
    // e.g. NV20261002001 or NV-20261002-001
    return sep ? `${cleanPrefix}${sep}${yyyy}${mm}${dd}${sep}${seqStr}` : `${cleanPrefix}${yyyy}${mm}${dd}${seqStr}`;
  }

  if (format === 'YEAR_SEQUENTIAL') {
    // e.g. NV-2026-001 or NV2026001
    return sep ? `${cleanPrefix}${sep}${yyyy}${sep}${seqStr}` : `${cleanPrefix}${yyyy}${seqStr}`;
  }

  // Default: SEQUENTIAL (e.g. NV001 or NV-001)
  return sep ? `${cleanPrefix}${sep}${seqStr}` : `${cleanPrefix}${seqStr}`;
}

export function calculateBillTotals(lineItems = [], taxRate = 0) {
  const sanitizedItems = lineItems.map((item, idx) => {
    const qty = Math.max(0, Number(item.quantity) || 1);
    const price = Math.max(0, Number(item.price ?? item.rate) || 0);
    const amount = Number((qty * price).toFixed(2));
    return {
      id: item.id || idx + 1,
      name: item.name || item.description || `Item ${idx + 1}`,
      quantity: qty,
      price,
      amount,
    };
  });

  const subtotal = Number(sanitizedItems.reduce((acc, item) => acc + item.amount, 0).toFixed(2));
  const normalizedTaxRate = Math.max(0, Number(taxRate) || 0);
  const taxAmount = Number(((subtotal * normalizedTaxRate) / 100).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));

  return {
    lineItems: sanitizedItems,
    subtotal,
    taxRate: normalizedTaxRate,
    taxAmount,
    total,
  };
}

export async function generateSequentialInvoiceNumber(userId, customDate) {
  const { db } = await connectToDatabase();
  const profile = await db.collection('billing_profiles').findOne({ userId });
  const settings = profile?.invoiceSettings || {
    prefix: 'NV',
    format: 'DATE_BASED',
    separator: '',
    digits: 3,
    nextSequence: 1,
  };

  const sequence = settings.nextSequence || 1;
  const invoiceNumber = formatInvoiceNumber({
    prefix: settings.prefix,
    format: settings.format,
    separator: settings.separator,
    digits: settings.digits,
    sequence,
    date: customDate || new Date(),
  });

  // Increment sequence counter atomically for this user's profile
  await db.collection('billing_profiles').updateOne(
    { userId },
    { $inc: { 'invoiceSettings.nextSequence': 1 } }
  );

  return invoiceNumber;
}

export async function previewNextInvoiceNumber(userId, customDate) {
  const { db } = await connectToDatabase();
  const profile = await db.collection('billing_profiles').findOne({ userId });
  const settings = profile?.invoiceSettings || {
    prefix: 'NV',
    format: 'DATE_BASED',
    separator: '',
    digits: 3,
    nextSequence: 1,
  };

  return formatInvoiceNumber({
    prefix: settings.prefix,
    format: settings.format,
    separator: settings.separator,
    digits: settings.digits,
    sequence: settings.nextSequence || 1,
    date: customDate || new Date(),
  });
}
