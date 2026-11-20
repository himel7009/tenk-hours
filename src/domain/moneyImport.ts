import type { DayKey } from './dates';
import { stableUuid } from './ids';
import { cleanNote, monthOf, parseAmount, type MonthKey } from './money';

/**
 * Reads a monthly expense sheet laid out the common way: a date column, one
 * column per section with the day's total, a Days column, the budgets in the
 * first data row, and a details column per section with one item per line
 * ("130 taka bus", "push 390").
 */

/** Splits CSV text into rows, keeping quoted cells with commas and line breaks whole. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export interface ImportedItem {
  /** Same text, same id, so importing a sheet again replaces rather than duplicates. */
  id: string;
  day: DayKey;
  amount: number;
  note: string;
}

export interface ImportedSection {
  name: string;
  budget: number;
  items: ImportedItem[];
  spent: number;
}

export interface ImportedSheet {
  month: MonthKey;
  sections: ImportedSection[];
  /** Lines in the details that had no amount, kept so nothing is lost silently. */
  skipped: { day: DayKey; text: string }[];
  /** Days whose listed items add up to more than the day's total. */
  mismatches: { day: DayKey; section: string; total: number; items: number }[];
}

export class SheetImportError extends Error {}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toLowerCase())
    .join('');

/** Whether a header such as "PE Budget" or "Meal Details" names this section. */
function names(header: string, section: string, suffix: RegExp): boolean {
  const base = header.replace(suffix, '').trim().toLowerCase();
  if (base === '') return false;
  return base === section.toLowerCase() || base === initials(section);
}

/** dd/mm/yy or dd/mm/yyyy. */
function parseDay(text: string): DayKey | null {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*$/.exec(text);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y!.length === 2 ? 2000 + Number(y) : Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Splits on commas, but not inside brackets or between digits ("1,000"). */
function splitPieces(text: string): string[] {
  const pieces: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    const thousands = /\d/.test(text[i - 1] ?? '') && /\d{3}/.test(text.slice(i + 1, i + 4));
    if ((char === ',' && depth === 0 && !thousands) || char === '\n') {
      pieces.push(current);
      current = '';
    } else current += char;
  }
  pieces.push(current);
  return pieces.map((piece) => piece.trim()).filter(Boolean);
}

const LEADING = /^(\d[\d,]*(?:\.\d{1,2})?)\s*(?:taka|tk|৳)?\s*(.*)$/i;
const TRAILING = /^(.*?)\s+(\d[\d,]*(?:\.\d{1,2})?)\s*(?:taka|tk|৳)?$/i;

/**
 * Items in one details cell. "5 taka Fahim 20 taka baat" is two items: a
 * piece that starts with an amount is split before each later "N taka".
 */
export function parseItems(text: string): {
  items: { amount: number; note: string }[];
  skipped: string[];
} {
  const items: { amount: number; note: string }[] = [];
  const skipped: string[] = [];
  for (const piece of splitPieces(text)) {
    const parts = LEADING.test(piece)
      ? piece.split(/\s+(?=\d[\d,]*(?:\.\d{1,2})?\s*taka\b)/i)
      : [piece];
    for (const part of parts) {
      const leading = LEADING.exec(part);
      const trailing = leading ? null : TRAILING.exec(part);
      const amount = parseAmount((leading?.[1] ?? trailing?.[2] ?? '').replace(/,/g, ''));
      if (amount === null) {
        skipped.push(part);
        continue;
      }
      items.push({ amount, note: cleanNote(leading ? leading[2]! : trailing![1]!) });
    }
  }
  return { items, skipped };
}

export function parseExpenseSheet(text: string): ImportedSheet {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const header = rows[0]?.map((cell) => cell.trim()) ?? [];
  const daysColumn = header.findIndex((cell) => /^days?$/i.test(cell));
  if (daysColumn < 2 || !rows.slice(1).some((row) => parseDay(row[0] ?? ''))) {
    throw new SheetImportError(
      'This does not look like a monthly expense sheet. It needs a date column, a column per section and a Days column.',
    );
  }

  const sectionNames = header.slice(1, daysColumn).filter(Boolean);
  const firstData = rows[1] ?? [];
  // Budgets sit after the Days column: "PE Budget", or a bare section name
  // that follows the first budget heading.
  const firstBudget = header.findIndex((cell, index) => index > daysColumn && /budget/i.test(cell));
  const detailsFrom = header.findIndex(
    (cell, index) => index > daysColumn && /details?$/i.test(cell),
  );

  const dataRows = rows
    .slice(1)
    .map((row) => ({ row, day: parseDay(row[0] ?? '') }))
    .filter((entry): entry is { row: string[]; day: DayKey } => entry.day !== null);
  const month = monthOf(dataRows[0]!.day);

  const skipped: ImportedSheet['skipped'] = [];
  const mismatches: ImportedSheet['mismatches'] = [];

  const sections = sectionNames.map((name, position) => {
    const totalColumn = 1 + position;
    let budgetColumn = header.findIndex(
      (cell, index) => index > daysColumn && /budget/i.test(cell) && names(cell, name, /budget/i),
    );
    if (budgetColumn === -1 && firstBudget !== -1) {
      budgetColumn = header.findIndex(
        (cell, index) =>
          index > firstBudget &&
          (detailsFrom === -1 || index < detailsFrom) &&
          names(cell, name, /$^/),
      );
    }
    const detailsColumn = header.findIndex(
      (cell, index) =>
        index > daysColumn && /details?$/i.test(cell) && names(cell, name, /details?$/i),
    );

    const items: ImportedItem[] = [];
    for (const { row, day } of dataRows) {
      const total = parseAmount(row[totalColumn] ?? '') ?? 0;
      const parsed =
        detailsColumn === -1 ? { items: [], skipped: [] } : parseItems(row[detailsColumn] ?? '');
      for (const text of parsed.skipped) skipped.push({ day, text });
      const listed = parsed.items.reduce((sum, item) => sum + item.amount, 0);
      const dayItems = parsed.items.map((item, index) => ({ ...item, index }));
      // The day's total is what was spent; items that fall short leave a
      // remainder that was spent but not written down.
      if (total > listed) {
        dayItems.push({
          amount: total - listed,
          note: listed === 0 ? '' : 'Not itemised',
          index: dayItems.length,
        });
      } else if (listed > total && total > 0) {
        mismatches.push({ day, section: name, total, items: listed });
      }
      for (const item of dayItems) {
        items.push({
          id: stableUuid(`import:${month}:${name.toLowerCase()}:${day}:${item.index}`),
          day,
          amount: item.amount,
          note: item.note,
        });
      }
    }

    return {
      name,
      budget: budgetColumn === -1 ? 0 : (parseAmount(firstData[budgetColumn] ?? '') ?? 0),
      items,
      spent: items.reduce((sum, item) => sum + item.amount, 0),
    };
  });

  return { month, sections, skipped, mismatches };
}
