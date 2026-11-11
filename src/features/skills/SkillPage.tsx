import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { formatDuration, formatHours, formatMonthYear } from '../../domain/format';
import type { Progress } from '../../domain/progress';
import type { Skill } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { Heatmap } from '../progress/Heatmap';
import { HourField } from '../progress/HourField';
import { MilestoneTrack } from '../progress/MilestoneTrack';
import { useToday } from '../progress/useNow';
import { useSkillProgress, useSkillSessions } from '../progress/useProgress';
import { LogTimeForm } from '../sessions/LogTimeForm';
import { SessionList } from '../sessions/SessionList';
import { TimerPanel } from '../timer/TimerPanel';
import { SkillFormDialog } from './SkillFormDialog';
import styles from './SkillPage.module.css';

export function SkillPage() {
  const { skillId } = useParams();
  const skill = useTrackerStore((state) => state.skills.find((s) => s.id === skillId));

  if (!skill) {
    return (
      <div>
        <h1>This skill no longer exists</h1>
        <p className={styles.missing}>
          <Link to="/">Go to your skills</Link>
        </p>
      </div>
    );
  }
  return <SkillDetail key={skill.id} skill={skill} />;
}

function SkillDetail({ skill }: { skill: Skill }) {
  const today = useToday();
  const sessions = useSkillSessions(skill.id);
  const progress = useSkillProgress(skill);
  const [editing, setEditing] = useState(false);

  return (
    <div data-color={skill.color}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          All skills
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{skill.name}</h1>
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Edit skill
          </Button>
        </div>
        <p className={`tabular ${styles.total}`}>
          <strong>{formatHours(progress.loggedMinutes)}</strong> of{' '}
          {skill.targetHours.toLocaleString()} hours
        </p>
      </header>

      <div className={styles.columns}>
        <HourField loggedMinutes={progress.loggedMinutes} targetHours={skill.targetHours} />

        <div className={styles.side}>
          <section className={styles.panel} aria-label="Timer">
            <TimerPanel skill={skill} />
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Log time you already spent</h2>
            <LogTimeForm skill={skill} />
          </section>

          <ProgressFacts progress={progress} />
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Milestones</h2>
        <MilestoneTrack loggedMinutes={progress.loggedMinutes} targetHours={skill.targetHours} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Last 26 weeks</h2>
        <Heatmap byDay={progress.byDay} today={today} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sessions</h2>
        <SessionList sessions={sessions} />
      </section>

      {editing && <SkillFormDialog skill={skill} onClose={() => setEditing(false)} />}
    </div>
  );
}

function ProgressFacts({ progress }: { progress: Progress }) {
  const { streak, pace, finishDay, loggedMinutes, nextMilestoneHours } = progress;
  const days = (count: number) => `${count} day${count === 1 ? '' : 's'}`;

  const facts: [label: string, value: string][] = [
    ['Current streak', days(streak.current)],
    ['Longest streak', days(streak.longest)],
    ['Pace, last 30 days', pace > 0 ? `${formatDuration(pace)} a day` : 'No time logged'],
    [
      'Next milestone',
      nextMilestoneHours === null
        ? 'Target reached'
        : `${nextMilestoneHours.toLocaleString()}h, ${formatDuration(nextMilestoneHours * 60 - loggedMinutes)} to go`,
    ],
    [
      'Target reached at this pace',
      nextMilestoneHours === null
        ? 'Done'
        : finishDay
          ? formatMonthYear(finishDay)
          : 'Not enough data',
    ],
  ];

  return (
    <dl className={styles.facts}>
      {facts.map(([label, value]) => (
        <div key={label} className={styles.fact}>
          <dt>{label}</dt>
          <dd className="tabular">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
