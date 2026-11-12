import { useMemo } from 'react';
import { summarizeProgress, type Progress } from '../../domain/progress';
import type { Session, Skill } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from './useNow';

export function useSkillSessions(skillId: string): Session[] {
  const sessions = useTrackerStore((state) => state.sessions);
  return useMemo(() => sessions.filter((s) => s.skillId === skillId), [sessions, skillId]);
}

/** Progress for one skill or habit. Streaks are always per tracker. */
export function useSkillProgress(skill: Skill): Progress {
  const sessions = useSkillSessions(skill.id);
  const today = useToday();
  return useMemo(
    () => summarizeProgress(sessions, skill.targetHours, skill.dailyGoalMinutes, today),
    [sessions, skill.targetHours, skill.dailyGoalMinutes, today],
  );
}

/** Minutes logged today across every skill and habit. */
export function useMinutesToday(): number {
  const sessions = useTrackerStore((state) => state.sessions);
  const today = useToday();
  return useMemo(
    () => sessions.reduce((sum, s) => (s.day === today ? sum + s.minutes : sum), 0),
    [sessions, today],
  );
}
