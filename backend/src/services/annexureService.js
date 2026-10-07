export const ANNEXURE_LIMITS = { maxColumns: 8, maxRows: 200, maxCell: 500, maxText: 20000, maxTitle: 80, maxLabel: 40 };

const DEFAULT_TITLE = 'Particulars / Summary';
const ALIGNS = ['left', 'center', 'right'];
const clip = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * Turns the legacy fixed-shape `particulars` list into a table annexure so old invoices keep rendering.
 */
function fromLegacyParticulars(particulars) {
  const rows = (Array.isArray(particulars) ? particulars : [])
    .filter((p) => p && clip(p.description, 1) !== '')
    .map((p, i) => [String(p.srNo || i + 1), clip(p.description, ANNEXURE_LIMITS.maxCell), clip(p.remarks || p.details, ANNEXURE_LIMITS.maxCell) || '-']);
  if (rows.length === 0) return null;
  return {
    mode: 'table',
    title: DEFAULT_TITLE,
    columns: [
      { label: 'Sr No', align: 'center', total: false },
      { label: 'Particulars / Description', align: 'left', total: false },
      { label: 'Details / Remarks', align: 'left', total: false },
    ],
    rows,
  };
}

/**
 * Validates and normalises an annexure ({ mode: 'table' | 'text', title, ... }) from untrusted input.
 * Falls back to `legacyParticulars` when no annexure is supplied. Returns null when there is nothing to print.
 */
export function normalizeAnnexure(annexure, legacyParticulars = []) {
  if (!annexure || typeof annexure !== 'object') return fromLegacyParticulars(legacyParticulars);

  const title = clip(annexure.title, ANNEXURE_LIMITS.maxTitle) || DEFAULT_TITLE;

  if (annexure.mode === 'text') {
    const text = String(annexure.text ?? '').replace(/\r\n?/g, '\n').trim().slice(0, ANNEXURE_LIMITS.maxText);
    return text ? { mode: 'text', title, text } : null;
  }

  const rawColumns = (Array.isArray(annexure.columns) ? annexure.columns : []).slice(0, ANNEXURE_LIMITS.maxColumns);
  const columns = rawColumns.map((c, i) => ({
    label: clip(c?.label, ANNEXURE_LIMITS.maxLabel) || `Column ${i + 1}`,
    align: ALIGNS.includes(c?.align) ? c.align : 'left',
    total: Boolean(c?.total),
  }));
  if (columns.length === 0) return null;

  const rows = (Array.isArray(annexure.rows) ? annexure.rows : [])
    .filter(Array.isArray)
    .map((r) => columns.map((_, i) => clip(r[i], ANNEXURE_LIMITS.maxCell)))
    .filter((r) => r.some((cell) => cell !== ''))
    .slice(0, ANNEXURE_LIMITS.maxRows);
  if (rows.length === 0) return null;

  return { mode: 'table', title, columns, rows };
}

/** Parses a cell such as "1.5", "1,200" or "₹ 40" into a number, or null if it isn't numeric. */
export function parseNumber(cell) {
  const cleaned = String(cell ?? '').replace(/[,\s]/g, '').replace(/^[^\d.+-]+/, '');
  if (cleaned === '' || !/^[+-]?\d*\.?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}
