import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import type { DayKey } from '../../domain/dates';
import { formatDay, formatDuration, formatHours } from '../../domain/format';
import { projectStats } from '../../domain/projectStats';
import type { Progress } from '../../domain/progress';
import type { Skill } from '../../domain/types';
import { StreakBadge } from '../progress/StreakBadge';
import { useToday } from '../progress/useNow';
import { useSkillProgress } from '../progress/useProgress';
import { WeekStrip } from '../progress/WeekStrip';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { useTimer } from '../timer/useTimer';
import styles from './SkillCard.module.css';
import { SkillFormDialog } from './SkillFormDialog';

interface SkillCardProps {
  skill: Skill;
}

interface CardSummary {
  headline: string;
  /** How full the bar is, or null for no bar. */
  fraction: number | null;
  caption: string;
}

/** Skills measure the long haul to the next milestone. */
function summarizeSkill(skill: Skill, progress: Progress): CardSummary {
  // Against 10,000 hours a bar barely moves, so measure to the next milestone.
  const milestone = progress.nextMilestoneHours ?? skill.targetHours;
  const fraction = Math.min(1, progress.loggedMinutes / (milestone * 60));
  return {
    headline: `${formatHours(progress.loggedMinutes)} of ${skill.targetHours.toLocaleString()} hours`,
    fraction,
    caption:
      progress.nextMilestoneHours === null
        ? 'Target reached'
        : `${Math.floor(fraction * 100)}% of the way to ${milestone.toLocaleString()}h`,
  };
}

/** Habits measure today against the daily goal. */
function summarizeHabit(skill: Skill, progress: Progress): CardSummary {
  const remaining = skill.dailyGoalMinutes - progress.minutesToday;
  return {
    headline: `${formatDuration(progress.minutesToday)} of ${formatDuration(skill.dailyGoalMinutes)} today`,
    fraction: Math.min(1, progress.minutesToday / skill.dailyGoalMinutes),
    caption: remaining <= 0 ? 'Done for today' : `${formatDuration(remaining)} to go today`,
  };
}

/** One skill or habit on the home page: where it stands and a way to start. */
/** Projects just add up time: no target, no goal, so no bar. */
function summarizeProject(progress: Progress, today: DayKey): CardSummary {
  const { weekMinutes, lastDay } = projectStats(progress.byDay, today);
  const last =
    lastDay === null
      ? 'Not started yet'
      : lastDay === today
        ? 'Worked on today'
        : `Last worked on ${formatDay(lastDay, today)}`;
  return {
    headline: `${formatDuration(progress.loggedMinutes)} in all`,
    fraction: null,
    caption: weekMinutes > 0 ? `${formatDuration(weekMinutes)} this week. ${last}.` : `${last}.`,
  };
}

const NOUNS = { skill: 'skill', habit: 'habit', project: 'project' } as const;

export function SkillCard({ skill }: SkillCardProps) {
  const today = useToday();
  const progress = useSkillProgress(skill);
  const { activeTimer, start } = useTimer();
  const running = activeTimer?.skillId === skill.id;
  const deleteSkill = useTrackerStore((state) => state.deleteSkill);
  const sessionCount = useTrackerStore(
    (state) => state.sessions.filter((session) => session.skillId === skill.id).length,
  );
  const toast = useToastStore((state) => state.show);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const noun = NOUNS[skill.kind];
  const isProject = skill.kind === 'project';

  const handleDelete = () => {
    deleteSkill(skill.id);
    toast(`Deleted ${skill.name}`);
  };
  const { headline, fraction, caption } =
    skill.kind === 'habit'
      ? summarizeHabit(skill, progress)
      : isProject
        ? summarizeProject(progress, today)
        : summarizeSkill(skill, progress);

  return (
    <li className={styles.card} data-color={skill.color}>
      <Link to={`/skills/${skill.id}`} className={styles.main}>
        <span className={styles.icon} aria-hidden="true">
          {skill.icon}
        </span>
        <span className={styles.heading}>
          <span className={styles.name}>{skill.name}</span>
          <span className={`tabular ${styles.headline}`}>{headline}</span>
        </span>
        {fraction !== null && (
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.barFill} style={{ width: `${fraction * 100}%` }} />
          </span>
        )}
        <span className={`tabular ${styles.caption}`}>{caption}</span>
      </Link>

      <div className={styles.shortcuts}>
        <button
          type="button"
          className={styles.shortcut}
          onClick={() => setEditing(true)}
          aria-label={`Edit ${skill.name}`}
          title={`Edit ${noun}`}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.3 1.9a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8 8-3.3.8.8-3.3 7.7-8.3Z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.shortcut} ${styles.shortcutDanger}`}
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Delete ${skill.name}`}
          title={`Delete ${noun}`}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9.5h6.8L12 4M6.7 6.5V11M9.3 6.5V11" />
          </svg>
        </button>
      </div>

      {confirmingDelete ? (
        <div className={styles.confirm} role="alertdialog" aria-label={`Delete ${skill.name}`}>
          <p>
            Delete this {noun}
            {sessionCount > 0 && ` and its ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
            ? This cannot be undone.
          </p>
          <div className={styles.confirmActions}>
            <Button size="sm" variant="quiet" onClick={() => setConfirmingDelete(false)} autoFocus>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete}>
              Delete {noun}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.footer}>
          <div className={styles.streak}>
            {isProject ? (
              <span className={`tabular ${styles.today}`}>
                {progress.minutesToday > 0
                  ? `${formatDuration(progress.minutesToday)} today`
                  : 'Nothing today'}
              </span>
            ) : (
              <StreakBadge streak={progress.streak} />
            )}
            <WeekStrip
              // A project has no goal, so any time at all fills its day.
              completedDays={isProject ? new Set(progress.byDay.keys()) : progress.completedDays}
              doneLabel={isProject ? 'worked on' : undefined}
              activeDays={progress.byDay}
              today={today}
            />
          </div>
          <Button
            size="sm"
            onClick={() => start(skill.id, isProject ? null : skill.dailyGoalMinutes * 60)}
            disabled={Boolean(activeTimer)}
          >
            {running
              ? 'Timer running'
              : isProject
                ? 'Start timer'
                : `Start ${formatDuration(skill.dailyGoalMinutes)}`}
          </Button>
        </div>
      )}

      {editing && <SkillFormDialog skill={skill} onClose={() => setEditing(false)} />}
    </li>
  );
}
