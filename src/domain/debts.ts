import { daysBetween, type DayKey } from './dates';
import type { MoneySectionId } from './money';

/**
 * Money owed. `borrowed`: you owe someone. `lent`: someone owes you. A debt
 * can say which section the money went into (borrowed) or came out of
 * (lent), and each payment which section it was paid from or into, so the
 * section balances stay true. None of it counts as spending.
 */
export type DebtId = string;
export type DebtDirection = 'borrowed' | 'lent';

export interface Debt {
  id: DebtId;
  direction: DebtDirection;
  person: string;
  /** Paisa, positive. */
  amount: number;
  /** When the money changed hands. */
  day: DayKey;
  /** When it should be settled, if there is a deadline. */
  dueDay: DayKey | null;
  /** Where the borrowed money went, or the lent money came from. */
  sectionId: MoneySectionId | null;
  note: string;
  createdAt: number;
}

export interface DebtPayment {
  id: string;
  debtId: DebtId;
  day: DayKey;
  amount: number;
  /** The section paid from (borrowed) or into (lent). */
  sectionId: MoneySectionId | null;
  note: string;
  createdAt: number;
}

export const DEBT_PERSON_MAX = 80;

export type DebtStatus = 'settled' | 'overdue' | 'due-soon' | 'open';

/** Days before the deadline when a debt starts to say so. */
export const DUE_SOON_DAYS = 3;

export interface DebtSummary {
  debt: Debt;
  paid: number;
  left: number;
  payments: DebtPayment[];
  status: DebtStatus;
  /** Days until the deadline: negative once it has passed. Null without one. */
  daysToDue: number | null;
  /** The day the last payment settled it. */
  settledOn: DayKey | null;
}

export function summarizeDebt(
  debt: Debt,
  payments: readonly DebtPayment[],
  today: DayKey,
): DebtSummary {
  const own = payments
    .filter((payment) => payment.debtId === debt.id)
    .sort((a, b) => a.day.localeCompare(b.day) || a.createdAt - b.createdAt);
  const paid = own.reduce((sum, payment) => sum + payment.amount, 0);
  const left = Math.max(0, debt.amount - paid);
  const daysToDue = debt.dueDay === null ? null : daysBetween(today, debt.dueDay);
  const status: DebtStatus =
    left === 0
      ? 'settled'
      : daysToDue !== null && daysToDue < 0
        ? 'overdue'
        : daysToDue !== null && daysToDue <= DUE_SOON_DAYS
          ? 'due-soon'
          : 'open';
  return {
    debt,
    paid,
    left,
    payments: own,
    status,
    daysToDue,
    settledOn: left === 0 ? (own.at(-1)?.day ?? debt.day) : null,
  };
}

export interface DebtBook {
  /** Open debts you owe, most urgent first. */
  owe: DebtSummary[];
  /** Open debts owed to you, most urgent first. */
  owed: DebtSummary[];
  /** Settled ones, most recent first. */
  settled: DebtSummary[];
  oweTotal: number;
  owedTotal: number;
  /** Overdue or due within a few days, most urgent first. */
  urgent: DebtSummary[];
}

const URGENCY: Record<DebtStatus, number> = { overdue: 0, 'due-soon': 1, open: 2, settled: 3 };

function byUrgency(a: DebtSummary, b: DebtSummary): number {
  return (
    URGENCY[a.status] - URGENCY[b.status] ||
    (a.daysToDue ?? Infinity) - (b.daysToDue ?? Infinity) ||
    a.debt.day.localeCompare(b.debt.day)
  );
}

export function buildDebtBook(
  debts: readonly Debt[],
  payments: readonly DebtPayment[],
  today: DayKey,
): DebtBook {
  const all = debts.map((debt) => summarizeDebt(debt, payments, today));
  const open = all.filter((s) => s.status !== 'settled').sort(byUrgency);
  const owe = open.filter((s) => s.debt.direction === 'borrowed');
  const owed = open.filter((s) => s.debt.direction === 'lent');
  return {
    owe,
    owed,
    settled: all
      .filter((s) => s.status === 'settled')
      .sort((a, b) => (b.settledOn ?? '').localeCompare(a.settledOn ?? '')),
    oweTotal: owe.reduce((sum, s) => sum + s.left, 0),
    owedTotal: owed.reduce((sum, s) => sum + s.left, 0),
    urgent: open.filter((s) => s.status === 'overdue' || s.status === 'due-soon'),
  };
}

/** How debts moved money in and out of one section between two days. */
export interface DebtFlows {
  /** Borrowed money put into the section. */
  borrowed: number;
  /** Paid back to others out of the section. */
  repaid: number;
  /** Lent to others out of the section. */
  lent: number;
  /** Paid back to you into the section. */
  returned: number;
}

export function debtFlows(
  sectionId: MoneySectionId,
  debts: readonly Debt[],
  payments: readonly DebtPayment[],
  inRange: (day: DayKey) => boolean,
): DebtFlows {
  const flows: DebtFlows = { borrowed: 0, repaid: 0, lent: 0, returned: 0 };
  const direction = new Map(debts.map((debt) => [debt.id, debt.direction]));
  for (const debt of debts) {
    if (debt.sectionId !== sectionId || !inRange(debt.day)) continue;
    if (debt.direction === 'borrowed') flows.borrowed += debt.amount;
    else flows.lent += debt.amount;
  }
  for (const payment of payments) {
    if (payment.sectionId !== sectionId || !inRange(payment.day)) continue;
    const kind = direction.get(payment.debtId);
    if (kind === 'borrowed') flows.repaid += payment.amount;
    if (kind === 'lent') flows.returned += payment.amount;
  }
  return flows;
}

/** What the flows do to a section's balance. */
export const debtNet = (flows: DebtFlows): number =>
  flows.borrowed + flows.returned - flows.repaid - flows.lent;

/** "Due today", "Due in 3 days", "4 days overdue", "No deadline". */
export function describeDue(summary: Pick<DebtSummary, 'daysToDue' | 'status'>): string {
  const { daysToDue } = summary;
  if (summary.status === 'settled') return 'Settled';
  if (daysToDue === null) return 'No deadline';
  if (daysToDue === 0) return 'Due today';
  if (daysToDue === 1) return 'Due tomorrow';
  if (daysToDue > 1) return `Due in ${daysToDue} days`;
  return `${-daysToDue} day${daysToDue === -1 ? '' : 's'} overdue`;
}
