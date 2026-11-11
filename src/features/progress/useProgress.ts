import { useMemo } from 'react';
import { summarizeProgress, type Progress } from '../../domain/progress';
import { DEFAULT_TARGET_HOURS, type Session, type Skill } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from './useNow';

export function useSkillSessions(skillId: string): Session[] {
  const sessions = useTrackerStore((state) => state.sessions);
  return useMemo(() => sessions.filter((s) => s.skillId === skillId), [sessions, skillId]);
}

export function useSkillProgress(skill: Skill): Progress {
  const sessions = useSkillSessions(skill.id);
  const today = useToday();
  return useMemo(
    () => summarizeProgress(sessions, skill.targetHours, today),
    [sessions, skill.targetHours, today],
  );
}

/** Progress across every skill, used for the overall streak. */
export function useOverallProgress(): Progress {
  const sessions = useTrackerStore((state) => state.sessions);
  const today = useToday();
  return useMemo(() => summarizeProgress(sessions, DEFAULT_TARGET_HOURS, today), [sessions, today]);
}
