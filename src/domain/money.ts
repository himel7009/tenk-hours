import { addDays, daysBetween, fromDayKey, toDayKey, type DayKey } from './dates';
import { debtFlows, debtNet, type Debt, type DebtFlows, type DebtPayment } from './debts';
import { periodDays, shiftPeriod, type Period } from './report';
import type { SkillColor } from './types';

/**
 * Money is kept in sections, each a pot with its own budget: personal
 * expenses, meals, a fund. Amounts are whole paisa (1 taka = 100), so sums
 * never pick up floating point dust.
 */
export type MoneySectionId = string;
export type MoneyEntryId = string;

export interface MoneySection {
  id: MoneySectionId;
  name: string;
  icon: string;
  color: SkillColor;
  /** Whether what is left (or overspent) at the end of a month rolls into the next. */
  carryOver: boolean;
  createdAt: number;
}

/**
 * `spend` is money out of a section. `add` puts money into its budget: the
 * month's allowance or a top-up. `move` takes money out of one section and
 * into another (`toSectionId`) and is not spending.
 */
export type MoneyEntryKind = 'spend' | 'add' | 'move';

export interface MoneyEntry {
  id: MoneyEntryId;
  sectionId: MoneySectionId;
  kind: MoneyEntryKind;
  toSectionId: MoneySectionId | null;
  day: DayKey;
  /** Paisa, always positive. */
  amount: number;
  note: string;
  createdAt: number;
}

export const MONEY_NOTE_MAX = 200;
/** Ten crore taka in paisa: far above any real entry, below float trouble. */
export const MONEY_AMOUNT_MAX = 1_000_000_000;

const TAKA = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** "৳1,417", "৳11.50", "−৳108". */
export function formatTaka(paisa: number): string {
  const taka = Math.abs(paisa) / 100;
  const text = Number.isInteger(taka)
    ? TAKA.format(taka)
    : taka.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${paisa < 0 ? '−' : ''}৳${text}`;
}

/** Reads "1,200", "11.5" or "৳ 70" as paisa. Null if it is not a positive amount. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[৳,\s]|taka|tk/gi, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const paisa = Math.round(Number(cleaned) * 100);
  return paisa > 0 && paisa <= MONEY_AMOUNT_MAX ? paisa : null;
}

const AMOUNT = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;
const UNIT = String.raw`(?:\s*(?:taka|tk|৳))?`;
const AMOUNT_FIRST = new RegExp(String.raw`^\s*৳?\s*${AMOUNT}${UNIT}\b\s*(.*)$`, 'i');
const AMOUNT_LAST = new RegExp(String.raw`^(.*?)\s+৳?\s*${AMOUNT}${UNIT}\s*$`, 'i');

/**
 * One line as you would write it in a notebook: "130 bus", "bus 130",
 * "130 taka bus", "Gulsha mach 1 kg 938 taka". Null if no amount is found.
 */
export function parseQuickEntry(text: string): { amount: number; note: string } | null {
  const first = AMOUNT_FIRST.exec(text);
  const last = first ? null : AMOUNT_LAST.exec(text);
  const [amountText, note] = first ? [first[1]!, first[2]!] : last ? [last[2]!, last[1]!] : [];
  if (amountText === undefined) return null;
  const amount = parseAmount(amountText);
  if (amount === null) return null;
  return { amount, note: cleanNote(note ?? '') };
}

/** Trims a note and drops wrapping brackets: "( musk box)" becomes "musk box". */
export function cleanNote(note: string): string {
  return note
    .replace(/^[\s(:\-–—]+|[\s)]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, MONEY_NOTE_MAX);
}

/* ---- Tags: what kind of thing a note is, from the words people use. ---- */

export interface MoneyTag {
  id: string;
  label: string;
  icon: string;
  words: string[];
}

export const MONEY_TAGS: MoneyTag[] = [
  {
    id: 'transport',
    label: 'Transport',
    icon: '🛺',
    words: [
      'rickshaw',
      'riksha',
      'bus',
      'gari',
      'cng',
      'uber',
      'pathao',
      'bara',
      'vara',
      'bhara',
      'train',
      'launch',
      'fare',
      'auto',
      'taxi',
    ],
  },
  {
    id: 'groceries',
    label: 'Groceries',
    icon: '🥬',
    words: [
      'mach',
      'fish',
      'dim',
      'egg',
      'peyaj',
      'onion',
      'rosun',
      'ada',
      'saak',
      'shak',
      'kopi',
      'chal',
      'rice',
      'oil',
      'kechki',
      'gulsha',
      'koi',
      'sobji',
      'vegetable',
      'alu',
      'potato',
      'murgi',
      'chicken',
      'mangsho',
      'beef',
      'daal',
      'dal',
      'morich',
      'lobon',
      'salt',
      'bazar',
    ],
  },
  {
    id: 'food',
    label: 'Eating out and snacks',
    icon: '🍜',
    words: [
      'nasta',
      'naasta',
      'breakfast',
      'lunch',
      'dinner',
      'chowmin',
      'chotpoti',
      'fuchka',
      'baat',
      'bhat',
      'chop',
      'bora',
      'dew',
      'cha',
      'tea',
      'coffee',
      'chanachor',
      'snack',
      'biscuit',
      'cake',
      'burger',
      'pizza',
      'juice',
      'bowwaa',
      'meal',
      'khabar',
      'singara',
      'samucha',
      'piyaju',
    ],
  },
  {
    id: 'phone',
    label: 'Phone and internet',
    icon: '📶',
    words: [
      'recharge',
      'airtel',
      'gp',
      'grameenphone',
      'robi',
      'banglalink',
      'teletalk',
      'internet',
      'wifi',
      'mb',
      'data',
    ],
  },
  {
    id: 'fees',
    label: 'Bank and fees',
    icon: '🏦',
    words: ['bank', 'bkash', 'nagad', 'rocket', 'charge', 'fee', 'fees', 'service'],
  },
  {
    id: 'home',
    label: 'Home and care',
    icon: '🧴',
    words: [
      'tissue',
      'wash',
      'brush',
      'cleaner',
      'soap',
      'detergent',
      'shampoo',
      'paste',
      'agorbati',
      'doop',
      'lighter',
      'glass',
      'bottle',
      'box',
      'bucket',
      'mug',
      'towel',
      'bulb',
    ],
  },
  {
    id: 'study',
    label: 'Study',
    icon: '📚',
    words: [
      'pen',
      'pencil',
      'book',
      'khata',
      'notebook',
      'print',
      'photocopy',
      'xerox',
      'course',
      'udemy',
      'stationery',
      'paper',
    ],
  },
  {
    id: 'health',
    label: 'Health',
    icon: '💊',
    words: [
      'medicine',
      'oshud',
      'doctor',
      'pharmacy',
      'tablet',
      'mask',
      'musk',
      'saline',
      'hospital',
      'test',
      'active+',
    ],
  },
  {
    id: 'giving',
    label: 'Giving',
    icon: '🤲',
    words: [
      'donate',
      'donation',
      'dokhina',
      'dokhinaa',
      'sadaqah',
      'sadka',
      'zakat',
      'gift',
      'help',
    ],
  },
];

export const OTHER_TAG: MoneyTag = { id: 'other', label: 'Other', icon: '🏷️', words: [] };

const TAG_BY_WORD = new Map<string, MoneyTag>(
  MONEY_TAGS.flatMap((tag) => tag.words.map((word) => [word, tag] as const)),
);

/** The first tag whose word appears in the note, or Other. */
export function tagOf(note: string): MoneyTag {
  const words = note.toLowerCase().match(/[a-z+]+/g) ?? [];
  for (const word of words) {
    const tag = TAG_BY_WORD.get(word) ?? TAG_BY_WORD.get(word.replace(/s$/, ''));
    if (tag) return tag;
  }
  return OTHER_TAG;
}

/* ---- Months ---- */

/** "2026-11". */
export type MonthKey = string;

export const monthOf = (day: DayKey): MonthKey => day.slice(0, 7);

export function monthRange(month: MonthKey): { start: DayKey; end: DayKey; days: number } {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const start = toDayKey(new Date(year, index - 1, 1, 12));
  const end = toDayKey(new Date(year, index, 0, 12));
  return { start, end, days: daysBetween(start, end) + 1 };
}

export function shiftMonth(month: MonthKey, steps: number): MonthKey {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return monthOf(toDayKey(new Date(year, index - 1 + steps, 1, 12)));
}

export function monthLabel(month: MonthKey): string {
  return fromDayKey(monthRange(month).start).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/* ---- Balances ---- */

/** How an entry changes a section's balance. */
function effect(entry: MoneyEntry, sectionId: MoneySectionId): number {
  if (entry.kind === 'add') return entry.sectionId === sectionId ? entry.amount : 0;
  if (entry.kind === 'spend') return entry.sectionId === sectionId ? -entry.amount : 0;
  if (entry.sectionId === sectionId) return -entry.amount;
  return entry.toSectionId === sectionId ? entry.amount : 0;
}

export interface SectionMonth {
  section: MoneySection;
  /** Carried in from earlier months; zero unless the section carries over. */
  opening: number;
  added: number;
  movedIn: number;
  movedOut: number;
  spent: number;
  /** Money borrowed into, repaid from, lent from or paid back into the section. */
  debt: DebtFlows;
  /** Opening plus everything that came in, less what was moved, repaid or lent out. */
  budget: number;
  remaining: number;
  /** Fair share per day for the rest of the month, today included. Null when not useful. */
  dailyAllowance: number | null;
  /** At the pace so far, the day the money runs out, if before the month ends. */
  runsOutOn: DayKey | null;
}

export interface MoneyDay {
  day: DayKey;
  entries: MoneyEntry[];
  /** Spending only; adds and moves are not spending. */
  spent: number;
}

export interface MoneyMonth {
  month: MonthKey;
  sections: SectionMonth[];
  spent: number;
  budget: number;
  remaining: number;
  /** Newest first, only days with entries. */
  days: MoneyDay[];
  /** Days so far this month with no spending written down. */
  untracked: DayKey[];
  /** Days of the month up to today: all of them once it is over. */
  elapsedDays: number;
}

export function summarizeMoneyMonth(
  sections: readonly MoneySection[],
  entries: readonly MoneyEntry[],
  month: MonthKey,
  today: DayKey,
  debts: readonly Debt[] = [],
  payments: readonly DebtPayment[] = [],
): MoneyMonth {
  const { start, end, days: length } = monthRange(month);
  const inMonth = entries.filter((entry) => entry.day >= start && entry.day <= end);
  const before = entries.filter((entry) => entry.day < start);
  const lastCounted = today < end ? today : end;
  const elapsedDays = today < start ? 0 : daysBetween(start, lastCounted) + 1;
  const inProgress = today >= start && today <= end;
  const daysLeft = inProgress ? daysBetween(today, end) + 1 : 0;

  const summaries: SectionMonth[] = sections.map((section) => {
    const opening = section.carryOver
      ? before.reduce((sum, entry) => sum + effect(entry, section.id), 0) +
        debtNet(debtFlows(section.id, debts, payments, (day) => day < start))
      : 0;
    const debt = debtFlows(section.id, debts, payments, (day) => day >= start && day <= end);
    let added = 0;
    let movedIn = 0;
    let movedOut = 0;
    let spent = 0;
    for (const entry of inMonth) {
      if (entry.kind === 'add' && entry.sectionId === section.id) added += entry.amount;
      if (entry.kind === 'spend' && entry.sectionId === section.id) spent += entry.amount;
      if (entry.kind === 'move' && entry.sectionId === section.id) movedOut += entry.amount;
      if (entry.kind === 'move' && entry.toSectionId === section.id) movedIn += entry.amount;
    }
    const budget = opening + added + movedIn - movedOut + debtNet(debt);
    const remaining = budget - spent;

    let runsOutOn: DayKey | null = null;
    if (inProgress && remaining > 0 && spent > 0) {
      const perDay = spent / elapsedDays;
      const day = addDays(today, Math.floor(remaining / perDay));
      if (day < end) runsOutOn = day;
    }
    return {
      section,
      opening,
      added,
      movedIn,
      movedOut,
      spent,
      debt,
      budget,
      remaining,
      // Whole taka: nobody budgets 128.81 a day.
      dailyAllowance:
        inProgress && remaining > 0 ? Math.floor(remaining / daysLeft / 100) * 100 : null,
      runsOutOn,
    };
  });

  const byDay = new Map<DayKey, MoneyEntry[]>();
  for (const entry of inMonth) byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
  const days: MoneyDay[] = [...byDay]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, list]) => ({
      day,
      entries: [...list].sort((a, b) => a.createdAt - b.createdAt),
      spent: list.filter((e) => e.kind === 'spend').reduce((sum, e) => sum + e.amount, 0),
    }));

  const spendDays = new Set(inMonth.filter((e) => e.kind === 'spend').map((e) => e.day));
  const untracked = Array.from({ length: Math.min(elapsedDays, length) }, (_, index) =>
    addDays(start, index),
  ).filter((day) => !spendDays.has(day));

  return {
    month,
    sections: summaries,
    spent: summaries.reduce((sum, s) => sum + s.spent, 0),
    budget: summaries.reduce((sum, s) => sum + s.budget, 0),
    remaining: summaries.reduce((sum, s) => sum + s.remaining, 0),
    days,
    untracked,
    elapsedDays,
  };
}

/** Groups runs of days, for "9 to 14 Nov" instead of six dates. */
export function dayRuns(days: readonly DayKey[]): { from: DayKey; to: DayKey }[] {
  const runs: { from: DayKey; to: DayKey }[] = [];
  for (const day of [...days].sort()) {
    const last = runs.at(-1);
    if (last && addDays(last.to, 1) === day) last.to = day;
    else runs.push({ from: day, to: day });
  }
  return runs;
}

/* ---- Reports ---- */

export interface MoneyReport {
  period: Period;
  spent: number;
  /** The period before, cut to the same number of days while this one runs. */
  previousSpent: number;
  inProgress: boolean;
  elapsedDays: number;
  days: {
    day: DayKey;
    spent: number;
    future: boolean;
    bySection: { section: MoneySection; spent: number }[];
  }[];
  bySection: { section: MoneySection; spent: number; previousSpent: number }[];
  byTag: { tag: MoneyTag; spent: number; count: number }[];
  /** The biggest single expenses. */
  largest: MoneyEntry[];
  spendCount: number;
  biggestDay: { day: DayKey; spent: number } | null;
  /** Money that came in: budgets and top-ups. Moves are left out. */
  added: number;
}

export function buildMoneyReport(
  sections: readonly MoneySection[],
  entries: readonly MoneyEntry[],
  period: Period,
  today: DayKey,
): MoneyReport {
  const known = new Set(sections.map((section) => section.id));
  const spends = entries.filter((e) => e.kind === 'spend' && known.has(e.sectionId));
  const days = periodDays(period);
  const inProgress = period.start <= today && today <= period.end;
  const elapsed = days.filter((day) => day <= today);
  const previous = shiftPeriod(period, -1);
  const previousEnd = inProgress
    ? [addDays(previous.start, Math.max(0, elapsed.length - 1)), previous.end].sort()[0]!
    : previous.end;

  const inPeriod = spends.filter((e) => e.day >= period.start && e.day <= period.end);
  const inPrevious = spends.filter((e) => e.day >= previous.start && e.day <= previousEnd);
  const sum = (list: readonly MoneyEntry[]) => list.reduce((total, e) => total + e.amount, 0);

  const dayRows = days.map((day) => {
    const list = inPeriod.filter((e) => e.day === day);
    return {
      day,
      spent: sum(list),
      future: day > today,
      bySection: sections
        .map((section) => ({ section, spent: sum(list.filter((e) => e.sectionId === section.id)) }))
        .filter((part) => part.spent > 0),
    };
  });

  const tagTotals = new Map<string, { tag: MoneyTag; spent: number; count: number }>();
  for (const entry of inPeriod) {
    const tag = tagOf(entry.note);
    const row = tagTotals.get(tag.id) ?? { tag, spent: 0, count: 0 };
    row.spent += entry.amount;
    row.count += 1;
    tagTotals.set(tag.id, row);
  }

  const biggest = dayRows.reduce<(typeof dayRows)[number] | null>(
    (top, day) => (day.spent > (top?.spent ?? 0) ? day : top),
    null,
  );

  return {
    period,
    spent: sum(inPeriod),
    previousSpent: sum(inPrevious),
    inProgress,
    elapsedDays: elapsed.length,
    days: dayRows,
    bySection: sections
      .map((section) => ({
        section,
        spent: sum(inPeriod.filter((e) => e.sectionId === section.id)),
        previousSpent: sum(inPrevious.filter((e) => e.sectionId === section.id)),
      }))
      .filter((row) => row.spent > 0 || row.previousSpent > 0)
      .sort((a, b) => b.spent - a.spent),
    byTag: [...tagTotals.values()].sort((a, b) => b.spent - a.spent),
    // A day lists everything; longer periods only the biggest few.
    largest: [...inPeriod]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, period.kind === 'day' ? 100 : 5),
    spendCount: inPeriod.length,
    biggestDay: biggest ? { day: biggest.day, spent: biggest.spent } : null,
    added: sum(
      entries.filter(
        (e) =>
          e.kind === 'add' &&
          known.has(e.sectionId) &&
          e.day >= period.start &&
          e.day <= period.end,
      ),
    ),
  };
}

/** Spending by day, for the activity calendar. */
export function spendingByDay(entries: readonly MoneyEntry[]): Map<DayKey, number> {
  const byDay = new Map<DayKey, number>();
  for (const entry of entries) {
    if (entry.kind === 'spend') byDay.set(entry.day, (byDay.get(entry.day) ?? 0) + entry.amount);
  }
  return byDay;
}
