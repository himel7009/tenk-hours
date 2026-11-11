import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { formatHours } from '../../domain/format';
import type { Skill } from '../../domain/types';
import { StreakBadge } from '../progress/StreakBadge';
import { useSkillProgress } from '../progress/useProgress';
import { useTimer } from '../timer/useTimer';
import styles from './SkillRow.module.css';

interface SkillRowProps {
  skill: Skill;
}

export function SkillRow({ skill }: SkillRowProps) {
  const progress = useSkillProgress(skill);
  const { activeTimer, start } = useTimer();
  const running = activeTimer?.skillId === skill.id;

  // Against 10,000 hours a bar barely moves, so measure to the next milestone.
  const milestone = progress.nextMilestoneHours ?? skill.targetHours;
  const fraction = Math.min(1, progress.loggedMinutes / (milestone * 60));

  return (
    <li className={styles.row} data-color={skill.color}>
      <Link to={`/skills/${skill.id}`} className={styles.main}>
        <span className={styles.name}>{skill.name}</span>
        <span className={`tabular ${styles.hours}`}>
          {formatHours(progress.loggedMinutes)} of {skill.targetHours.toLocaleString()} hours
        </span>
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${fraction * 100}%` }} />
        </span>
        <span className={`tabular ${styles.milestone}`}>
          {progress.nextMilestoneHours === null
            ? 'Target reached'
            : `${Math.floor(fraction * 100)}% of the way to ${milestone.toLocaleString()}h`}
        </span>
      </Link>
      <StreakBadge streak={progress.streak} />
      <Button onClick={() => start(skill.id)} disabled={Boolean(activeTimer)}>
        {running ? 'Timer running' : 'Start timer'}
      </Button>
    </li>
  );
}
