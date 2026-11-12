import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { formatDuration, formatHours } from '../../domain/format';
import type { Progress } from '../../domain/progress';
import type { Skill } from '../../domain/types';
import { StreakBadge } from '../progress/StreakBadge';
import { useToday } from '../progress/useNow';
import { useSkillProgress } from '../progress/useProgress';
import { WeekStrip } from '../progress/WeekStrip';
import { useTimer } from '../timer/useTimer';
import styles from './SkillRow.module.css';

interface SkillRowProps {
  skill: Skill;
}

interface RowSummary {
  headline: string;
  fraction: number;
  caption: string;
}

/** Skills measure the long haul to the next milestone. */
function summarizeSkill(skill: Skill, progress: Progress): RowSummary {
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
function summarizeHabit(skill: Skill, progress: Progress): RowSummary {
  const remaining = skill.dailyGoalMinutes - progress.minutesToday;
  return {
    headline: `${formatDuration(progress.minutesToday)} of ${formatDuration(skill.dailyGoalMinutes)} today`,
    fraction: Math.min(1, progress.minutesToday / skill.dailyGoalMinutes),
    caption: remaining <= 0 ? 'Done for today' : `${formatDuration(remaining)} to go today`,
  };
}

export function SkillRow({ skill }: SkillRowProps) {
  const today = useToday();
  const progress = useSkillProgress(skill);
  const { activeTimer, start } = useTimer();
  const running = activeTimer?.skillId === skill.id;
  const { headline, fraction, caption } =
    skill.kind === 'habit' ? summarizeHabit(skill, progress) : summarizeSkill(skill, progress);

  return (
    <li className={styles.row} data-color={skill.color}>
      <span className={styles.icon} aria-hidden="true">
        {skill.icon}
      </span>
      <Link to={`/skills/${skill.id}`} className={styles.main}>
        <span className={styles.name}>{skill.name}</span>
        <span className={`tabular ${styles.headline}`}>{headline}</span>
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${fraction * 100}%` }} />
        </span>
        <span className={`tabular ${styles.caption}`}>{caption}</span>
      </Link>
      <div className={styles.streak}>
        <StreakBadge streak={progress.streak} />
        <WeekStrip progress={progress} today={today} />
      </div>
      <Button
        onClick={() => start(skill.id, skill.dailyGoalMinutes)}
        disabled={Boolean(activeTimer)}
      >
        {running ? 'Timer running' : `Start ${formatDuration(skill.dailyGoalMinutes)}`}
      </Button>
    </li>
  );
}
