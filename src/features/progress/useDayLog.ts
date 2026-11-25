import { useMemo } from 'react';
import { buildDayLog, type DayLog } from '../../domain/dayLog';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from './useNow';

/** Today's sessions across everything, newest first. */
export function useTodayLog(): DayLog {
  const sessions = useTrackerStore((state) => state.sessions);
  const skills = useTrackerStore((state) => state.skills);
  const today = useToday();
  return useMemo(() => buildDayLog(sessions, skills, today), [sessions, skills, today]);
}
