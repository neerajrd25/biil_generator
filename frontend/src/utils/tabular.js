export const MAX_COLUMNS = 8;
export const MAX_ROWS = 200;

const NUMERIC = /^[+-]?\d[\d,]*\.?\d*$|^[+-]?\.\d+$/;
const DATE_LIKE = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/;

export const isNumeric = (cell) => NUMERIC.test(String(cell).replace(/^[^\d.+-]+/, '').trim());
export const isDateLike = (cell) => DATE_LIKE.test(String(cell).trim());

/**
 * Parses text copied from Excel / Google Sheets (tab separated) or a CSV into a rectangular grid of strings.
 * Handles quoted cells (including embedded tabs, commas and newlines). Empty rows are dropped.
 */
export function parsePasted(text) {
  const input = String(text ?? '').replace(/\r\n?/g, '\n');
  if (input.trim() === '') return [];
  const delimiter = input.includes('\t') ? '\t' : ',';

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);

  const cleaned = rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
  const width = Math.max(0, ...cleaned.map((r) => r.length));
  return cleaned.map((r) => [...r, ...Array(width - r.length).fill('')]);
}

/** A first row with no numbers or dates in it is most likely a header. */
export function looksLikeHeader(grid) {
  if (grid.length < 2) return false;
  return grid[0].every((c) => c !== '' && !isNumeric(c) && !isDateLike(c));
}

/** Numeric columns read better right-aligned. */
export function guessAlign(cells) {
  const filled = cells.filter((c) => c !== '');
  return filled.length > 0 && filled.every((c) => isNumeric(c) && !isDateLike(c)) ? 'right' : 'left';
}

export const PRESETS = {
  timesheet: { title: 'Timesheet', columns: ['Date', 'Hours', 'Description', 'Task'], align: ['left', 'right', 'left', 'left'], total: [false, true, false, false] },
  deliverables: { title: 'Particulars / Summary', columns: ['Sr No', 'Particulars / Description', 'Details / Remarks'], align: ['center', 'left', 'left'], total: [false, false, false] },
};

export function presetAnnexure(key) {
  const p = PRESETS[key];
  return {
    mode: 'table',
    title: p.title,
    columns: p.columns.map((label, i) => ({ label, align: p.align[i], total: p.total[i] })),
    rows: [p.columns.map(() => '')],
    text: '',
  };
}

export const emptyAnnexure = () => presetAnnexure('deliverables');

/** Builds an annexure from an invoice loaded from the API (new `annexure` or legacy `particulars`). */
export function annexureFromBill(bill) {
  if (bill.annexure) return { ...emptyAnnexure(), ...bill.annexure };
  if (bill.particulars?.length) {
    return {
      ...emptyAnnexure(),
      rows: bill.particulars.map((p, i) => [String(p.srNo || i + 1), p.description || '', p.remarks || '']),
    };
  }
  return null;
}

/** Applies parsed pasted data to an annexure. */
export function applyImport(annexure, grid, { hasHeader, append }) {
  const header = hasHeader ? grid[0] : null;
  const body = hasHeader ? grid.slice(1) : grid;
  const width = Math.min(MAX_COLUMNS, Math.max(header ? header.length : 0, ...body.map((r) => r.length), 1));
  const fit = (r) => Array.from({ length: width }, (_, i) => r[i] ?? '');

  let columns;
  if (header) {
    columns = fit(header).map((label, i) => ({ label: label || `Column ${i + 1}`, align: guessAlign(body.map((r) => r[i] ?? '')), total: false }));
  } else {
    columns = Array.from({ length: width }, (_, i) => annexure.columns[i] || { label: `Column ${i + 1}`, align: guessAlign(body.map((r) => r[i] ?? '')), total: false });
  }

  const existing = append ? annexure.rows.filter((r) => r.some((c) => c !== '')) : [];
  const rows = [...existing.map(fit), ...body.map(fit)].slice(0, MAX_ROWS);
  return { ...annexure, mode: 'table', columns, rows: rows.length ? rows : [columns.map(() => '')] };
}
