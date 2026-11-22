import { useMemo } from 'react';
import { combineByDay } from '../../domain/activity';
import type { DayKey } from '../../domain/dates';
import { summarizeDashboard, type Dashboard } from '../../domain/dashboard';
import { summarizeDomain, type Domain, type DomainProgress } from '../../domain/domains';
import type { Skill } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from './useNow';

/** Everything the home page shows about skills and habits. */
export function useDashboard(): Dashboard {
  const skills = useTrackerStore((state) => state.skills);
  const sessions = useTrackerStore((state) => state.sessions);
  const today = useToday();
  return useMemo(() => summarizeDashboard(skills, sessions, today), [skills, sessions, today]);
}

/** A domain's skills and the hours and streak they add up to. */
export function useDomainProgress(domain: Domain): { skills: Skill[]; progress: DomainProgress } {
  const allSkills = useTrackerStore((state) => state.skills);
  const sessions = useTrackerStore((state) => state.sessions);
  const today = useToday();
  return useMemo(() => {
    const skills = allSkills.filter((skill) => skill.domainId === domain.id);
    return { skills, progress: summarizeDomain(skills, sessions, today) };
  }, [allSkills, sessions, today, domain]);
}

/** Minutes across every skill, habit and project, by day. */
export function useOverallActivity(dashboard: Dashboard): Map<DayKey, number> {
  return useMemo(
    () => combineByDay(dashboard.trackers.map(({ progress }) => progress.byDay)),
    [dashboard.trackers],
  );
}
