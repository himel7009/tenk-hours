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
  const today = useToday();
  return useMemo(
    () => summarizeMoneyMonth(sections, entries, month, today),
    [sections, entries, month, today],
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
