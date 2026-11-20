import { buildDebtBook, type DebtBook } from '../../domain/debts';
import { useMemo } from 'react';
import {
  buildMoneyReport,
  spendingByDay,
  summarizeMoneyMonth,
  type MoneyMonth,
  type MoneyReport,
  type MonthKey,
} from '../../domain/money';
import type { Period } from '../../domain/report';
import type { DayKey } from '../../domain/dates';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from './useNow';

/** Budgets, spending and what is left for each section in a month. */
export function useMoneyMonth(month: MonthKey): MoneyMonth {
  const sections = useTrackerStore((state) => state.moneySections);
  const entries = useTrackerStore((state) => state.moneyEntries);
  const debts = useTrackerStore((state) => state.debts);
  const payments = useTrackerStore((state) => state.debtPayments);
  const today = useToday();
  return useMemo(
    () => summarizeMoneyMonth(sections, entries, month, today, debts, payments),
    [sections, entries, month, today, debts, payments],
  );
}

/** Spending over a day, week or month, against the one before. */
export function useMoneyReport(period: Period): MoneyReport {
  const sections = useTrackerStore((state) => state.moneySections);
  const entries = useTrackerStore((state) => state.moneyEntries);
  const today = useToday();
  return useMemo(
    () => buildMoneyReport(sections, entries, period, today),
    [sections, entries, period, today],
  );
}

export function useSpendingByDay(): Map<DayKey, number> {
  const entries = useTrackerStore((state) => state.moneyEntries);
  return useMemo(() => spendingByDay(entries), [entries]);
}

/** Who you owe, who owes you, and what is due soon. */
export function useDebtBook(): DebtBook {
  const debts = useTrackerStore((state) => state.debts);
  const payments = useTrackerStore((state) => state.debtPayments);
  const today = useToday();
  return useMemo(() => buildDebtBook(debts, payments, today), [debts, payments, today]);
}
