import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/Button';
import type { DayKey } from '../../domain/dates';
import { formatDay, formatDuration, formatHours, formatMonthYear } from '../../domain/format';
import { projectStats } from '../../domain/projectStats';
import { hourMilestones, streakMilestones } from '../../domain/milestones';
import type { Progress } from '../../domain/progress';
import { plannedPhrase, routineOf } from '../../domain/routine';
import { hasDailyGoal, keepsStreak, type Skill } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { ActivityCalendar } from '../progress/ActivityCalendar';
import { HourField } from '../progress/HourField';
import { MilestoneTrack } from '../progress/MilestoneTrack';
import { TodayGoal } from '../progress/TodayGoal';
import { useToday } from '../progress/useNow';
import { useSkillProgress, useSkillSessions } from '../progress/useProgress';
import { LogTimeForm } from '../sessions/LogTimeForm';
import { SessionList } from '../sessions/SessionList';
import { TimerPanel } from '../timer/TimerPanel';
import { SkillFormDialog } from './SkillFormDialog';
import styles from './SkillPage.module.css';

const days = (count: number) => `${count} day${count === 1 ? '' : 's'}`;

export function SkillPage() {
  const { skillId } = useParams();
  const skill = useTrackerStore((state) => state.skills.find((s) => s.id === skillId));

  if (!skill) {
    return (
      <div>
        <h1>This page no longer exists</h1>
        <p className={styles.missing}>
          <Link to="/">Go to your skills and habits</Link>
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
  const domains = useTrackerStore((state) => state.domains);
  const domain = domains.find((candidate) => candidate.id === skill.domainId);
  const isHabit = skill.kind === 'habit';
  const isProject = skill.kind === 'project';
  const withGoal = hasDailyGoal(skill);
  const streakOn = withGoal && keepsStreak(skill);
  const routine = routineOf(skill);

  const activity = (
    <ActivityCalendar
      byDay={progress.byDay}
      today={today}
      goalMinutes={withGoal ? skill.dailyGoalMinutes : null}
    />
  );

  return (
    <div data-color={skill.color}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          Home
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <span className={styles.icon} aria-hidden="true">
              {skill.icon}
            </span>
            {skill.name}
          </h1>
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Edit {skill.kind}
          </Button>
        </div>
        <p className={styles.domain}>
          {domain && (
            <>
              Part of {domain.icon} {domain.name}.{' '}
            </>
          )}
          Planned {plannedPhrase(routine.days)}
          {streakOn ? '.' : '. No streak kept.'}
        </p>
        <p className={`tabular ${styles.total}`}>
          {isProject ? (
            <>
              <strong>{formatDuration(progress.loggedMinutes)}</strong> spent on it so far
            </>
          ) : isHabit && streakOn ? (
            <>
              <strong>{days(progress.streak.current)}</strong> streak, {progress.completedDays.size}{' '}
              completed in all
            </>
          ) : isHabit ? (
            <>
              <strong>{progress.completedDays.size}</strong> days completed,{' '}
              {formatDuration(progress.loggedMinutes)} in all
            </>
          ) : (
            <>
              <strong>{formatHours(progress.loggedMinutes)}</strong> of{' '}
              {skill.targetHours.toLocaleString()} hours
            </>
          )}
        </p>
      </header>

      <div className={styles.columns}>
        {isProject ? (
          <figure className={styles.habitCalendar}>
            {activity}
            <figcaption>Every day you worked on it. Darker squares are longer days.</figcaption>
          </figure>
        ) : isHabit ? (
          <figure className={styles.habitCalendar}>
            {activity}
            <figcaption>
              The third shade marks a day that reached the {formatDuration(skill.dailyGoalMinutes)}{' '}
              goal, the darkest twice that; lighter ones fell short.
            </figcaption>
          </figure>
        ) : (
          <HourField loggedMinutes={progress.loggedMinutes} targetHours={skill.targetHours} />
        )}

        <div className={styles.side}>
          <section className={styles.panel} aria-label="Today's goal">
            {!withGoal ? (
              <p className={`tabular ${styles.projectToday}`}>
                <strong>{formatDuration(progress.minutesToday)}</strong> today
              </p>
            ) : (
              <TodayGoal
                minutesToday={progress.minutesToday}
                goalMinutes={skill.dailyGoalMinutes}
                keepsStreak={streakOn}
                plannedToday={progress.plannedToday}
              />
            )}
          </section>

          <section className={styles.panel} aria-label="Timer">
            <TimerPanel skill={skill} />
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Log time you already spent</h2>
            <LogTimeForm skill={skill} />
          </section>

          {isProject ? (
            <ProjectFacts progress={progress} today={today} streakOn={streakOn} />
          ) : (
            <ProgressFacts skill={skill} progress={progress} streakOn={streakOn} />
          )}
        </div>
      </div>

      {!isProject && (!isHabit || streakOn) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Milestones</h2>
          <MilestoneTrack
            milestones={
              isHabit
                ? streakMilestones(progress.streak.longest)
                : hourMilestones(progress.loggedMinutes, skill.targetHours)
            }
          />
        </section>
      )}

      {!isHabit && !isProject && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Activity</h2>
          {activity}
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sessions</h2>
        <SessionList sessions={sessions} />
      </section>

      {editing && <SkillFormDialog skill={skill} onClose={() => setEditing(false)} />}
    </div>
  );
}

function ProgressFacts({
  skill,
  progress,
  streakOn,
}: {
  skill: Skill;
  progress: Progress;
  streakOn: boolean;
}) {
  const { streak, pace, finishDay, loggedMinutes, nextMilestoneHours } = progress;

  const facts: [label: string, value: string][] = [
    ...(streakOn
      ? ([
          ['Current streak', days(streak.current)],
          ['Longest streak', days(streak.longest)],
        ] as [string, string][])
      : ([['Days goal reached', progress.completedDays.size.toLocaleString()]] as [
          string,
          string,
        ][])),
    ['Pace, last 30 days', pace > 0 ? `${formatDuration(pace)} a day` : 'No time logged'],
  ];

  if (skill.kind === 'habit') {
    facts.push(['Total time', loggedMinutes > 0 ? formatDuration(loggedMinutes) : 'None yet']);
  } else {
    facts.push(
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
    );
  }

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

function ProjectFacts({
  progress,
  today,
  streakOn,
}: {
  progress: Progress;
  today: DayKey;
  streakOn: boolean;
}) {
  const { weekMinutes, monthMinutes, daysWorked, firstDay, lastDay } = projectStats(
    progress.byDay,
    today,
  );
  const facts: [label: string, value: string][] = [
    ...(streakOn
      ? ([
          ['Current streak', days(progress.streak.current)],
          ['Longest streak', days(progress.streak.longest)],
        ] as [string, string][])
      : []),
    ['Last 7 days', formatDuration(weekMinutes)],
    ['Last 30 days', formatDuration(monthMinutes)],
    ['Days worked on', days(daysWorked)],
    ['Started', firstDay ? formatDay(firstDay, today) : 'Not yet'],
    ['Last worked on', lastDay ? formatDay(lastDay, today) : 'Not yet'],
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
