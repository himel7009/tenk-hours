import { useMemo } from 'react';
import {
  buildReport,
  buildTrend,
  type Period,
  type Report,
  type TrendPoint,
} from '../../domain/report';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from './useNow';

/** How a week or month went, against the one before. */
export function useReport(period: Period): Report {
  const skills = useTrackerStore((state) => state.skills);
  const sessions = useTrackerStore((state) => state.sessions);
  const domains = useTrackerStore((state) => state.domains);
  const badHabits = useTrackerStore((state) => state.badHabits);
  const checkIns = useTrackerStore((state) => state.checkIns);
  const today = useToday();
  return useMemo(
    () => buildReport({ skills, sessions, domains, badHabits, checkIns }, period, today),
    [skills, sessions, domains, badHabits, checkIns, period, today],
  );
}

/** Total time in each of the last `count` periods, ending with `period`. */
export function useTrend(period: Period, count: number): TrendPoint[] {
  const sessions = useTrackerStore((state) => state.sessions);
  return useMemo(() => buildTrend(sessions, period, count), [sessions, period, count]);
}
