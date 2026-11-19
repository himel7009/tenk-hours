import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { usePersistentState } from '../../components/usePersistentState';
import type { Domain, DomainId } from '../../domain/domains';
import type { Skill, TrackerKind } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { BadHabitCard } from '../badHabits/BadHabitCard';
import { BadHabitFormDialog } from '../badHabits/BadHabitFormDialog';
import { LockScreen } from '../badHabits/LockScreen';
import { useBadHabitsLocked, useLockSession } from '../badHabits/lockSession';
import { PinDialog } from '../badHabits/PinDialog';
import { useUnansweredBadHabits } from '../badHabits/useBadHabitProgress';
import { DomainFormDialog } from '../domains/DomainFormDialog';
import { DomainPanel } from '../domains/DomainPanel';
import { ActivityCalendar } from '../progress/ActivityCalendar';
import { useDashboard, useOverallActivity } from '../progress/useDashboard';
import { useToday } from '../progress/useNow';
import { SkillCard } from '../skills/SkillCard';
import { SkillFormDialog } from '../skills/SkillFormDialog';
import styles from './HomePage.module.css';
import { DayCard, YearCard } from './TimeCards';
import { isPlannedOn } from '../../domain/routine';
import { RoutineCard } from '../routine/RoutineCard';
import { TodayTab } from './TodayTab';
import { TodayCard } from './TodayCard';
import { TrackerTabs } from './TrackerTabs';
import { WeekChart } from './WeekChart';

type DialogState =
  | { type: 'tracker'; kind: TrackerKind; domainId: DomainId | null }
  | { type: 'domain'; domain?: Domain }
  | { type: 'bad' }
  | { type: 'pin' }
  | null;

type TabId = 'today' | 'domains' | 'skills' | 'projects' | 'habits' | 'bad';

const TAB_COPY: Record<TabId, { label: string; note: string; empty: string; add: string }> = {
  today: {
    label: 'Today',
    note: 'Your to-dos, and what your weekly routine plans for today.',
    empty: '',
    add: '',
  },
  domains: {
    label: 'Domains',
    note: 'Fields that group skills and projects, with all their hours added up.',
    empty:
      'No domains yet. Add one, such as AI, to group skills like machine learning and deep learning.',
    add: 'Add domain',
  },
  skills: {
    label: 'Skills',
    note: 'Skills that stand alone, outside any domain.',
    empty: 'No standalone skills yet.',
    add: 'Add skill',
  },
  projects: {
    label: 'Projects',
    note: 'Work you just want to time. No target or streak, only the hours you put in.',
    empty: 'No projects outside a domain yet.',
    add: 'Add project',
  },
  habits: {
    label: 'Habits',
    note: 'Things you want to do every day.',
    empty: 'No habits yet.',
    add: 'Add habit',
  },
  bad: {
    label: 'Bad habits',
    note: 'Things you want to stay away from. Answer once a day: did you avoid it?',
    empty: 'No bad habits yet. Add one you want to quit, such as doomscrolling.',
    add: 'Add bad habit',
  },
};

const TAB_KIND: Record<Exclude<TabId, 'today' | 'domains' | 'bad'>, TrackerKind> = {
  skills: 'skill',
  projects: 'project',
  habits: 'habit',
};

export function HomePage() {
  const today = useToday();
  const skills = useTrackerStore((state) => state.skills);
  const domains = useTrackerStore((state) => state.domains);
  const badHabits = useTrackerStore((state) => state.badHabits);
  const unanswered = useUnansweredBadHabits();
  const hasLock = useTrackerStore((state) => state.badHabitLock !== null);
  const locked = useBadHabitsLocked();
  const lockNow = useLockSession((state) => state.lock);
  const dashboard = useDashboard();
  const overallActivity = useOverallActivity(dashboard);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [tab, setTab] = usePersistentState<TabId>('tenk:home-tab', 'today');

  // Unlocked bad habits lock again on leaving their tab or this page, and
  // whenever the app goes to the background.
  useEffect(() => {
    if (tab !== 'bad') lockNow();
  }, [tab, lockNow]);
  useEffect(() => {
    const lockWhenHidden = () => {
      if (document.visibilityState === 'hidden') lockNow();
    };
    document.addEventListener('visibilitychange', lockWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', lockWhenHidden);
      lockNow();
    };
  }, [lockNow]);

  const addTracker = (kind: TrackerKind, domainId: DomainId | null = null) =>
    setDialog({ type: 'tracker', kind, domainId });

  const lists: Record<Exclude<TabId, 'today' | 'domains' | 'bad'>, Skill[]> = {
    skills: skills.filter((skill) => skill.kind === 'skill' && skill.domainId === null),
    projects: skills.filter((skill) => skill.kind === 'project' && skill.domainId === null),
    habits: skills.filter((skill) => skill.kind === 'habit'),
  };
  // What the Today tab lists: domains, and trackers outside a domain, planned today.
  const plannedCount =
    domains.filter((domain) => isPlannedOn(domain.routineDays, today)).length +
    skills.filter((skill) => skill.domainId === null && isPlannedOn(skill.routineDays, today))
      .length;
  const isEmpty = skills.length === 0 && domains.length === 0 && badHabits.length === 0;
  const copy = TAB_COPY[tab];

  const dialogs = (
    <>
      {dialog?.type === 'tracker' && (
        <SkillFormDialog
          kind={dialog.kind}
          domainId={dialog.domainId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'domain' && (
        <DomainFormDialog domain={dialog.domain} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'bad' && <BadHabitFormDialog onClose={() => setDialog(null)} />}
      {dialog?.type === 'pin' && <PinDialog mode="set" onClose={() => setDialog(null)} />}
    </>
  );

  if (isEmpty) {
    return (
      <>
        <section className={styles.welcome}>
          <h1 className={styles.welcomeTitle}>Ten thousand hours, counted one at a time.</h1>
          <p className={styles.lede}>
            Track a skill you want to master, time the projects you work on, group them under a
            domain, or keep a habit every day. Set a timer, put in the time, and keep your streak
            alive.
          </p>
          <div className={styles.welcomeActions}>
            <Button variant="primary" onClick={() => addTracker('skill')}>
              Add a skill
            </Button>
            <Button onClick={() => setDialog({ type: 'domain' })}>Add a domain</Button>
            <Button onClick={() => addTracker('project')}>Add a project</Button>
            <Button onClick={() => addTracker('habit')}>Add a habit</Button>
            <Button onClick={() => setDialog({ type: 'bad' })}>Add a bad habit</Button>
          </div>
        </section>
        <div className={styles.welcomeTime}>
          <DayCard />
          <YearCard />
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <div className={styles.workspace}>
        {/* The overview rail stays in view on wide screens while the list scrolls. */}
        <aside className={styles.rail} aria-label="Overview">
          <div className={styles.today}>
            <TodayCard dashboard={dashboard} today={today} />
          </div>
          <RoutineCard />
          <div className={styles.insights}>
            <div className={styles.timePair}>
              <DayCard />
              <YearCard />
            </div>
            <WeekChart dashboard={dashboard} today={today} />
          </div>
        </aside>

        <section className={styles.trackers} aria-label="Your trackers">
          <section className={styles.activityCard} aria-labelledby="activity-title">
            <h2 id="activity-title" className={styles.activityTitle}>
              Activity across everything
            </h2>
            <ActivityCalendar byDay={overallActivity} today={today} />
          </section>
          <TrackerTabs
            tabs={[
              { id: 'today', label: 'Today', count: plannedCount },
              { id: 'domains', label: 'Domains', count: domains.length },
              { id: 'skills', label: 'Skills', count: lists.skills.length },
              { id: 'projects', label: 'Projects', count: lists.projects.length },
              { id: 'habits', label: 'Habits', count: lists.habits.length },
              {
                id: 'bad',
                label: 'Bad habits',
                // While locked, not even how many there are is shown.
                count: locked ? null : badHabits.length,
                // Shown on the tab so a missing answer is hard to miss.
                alert: !locked && unanswered > 0 ? `${unanswered} to answer today` : undefined,
              },
            ]}
            selected={tab}
            onSelect={setTab}
          >
            <div className={styles.panelHead}>
              <p className={styles.note}>{copy.note}</p>
              {tab === 'bad' && !locked && (
                <Button
                  variant="quiet"
                  onClick={hasLock ? lockNow : () => setDialog({ type: 'pin' })}
                >
                  {hasLock ? 'Lock now' : 'Lock with a PIN'}
                </Button>
              )}
              {tab !== 'today' && !(tab === 'bad' && locked) && (
                <Button
                  onClick={() =>
                    tab === 'domains'
                      ? setDialog({ type: 'domain' })
                      : tab === 'bad'
                        ? setDialog({ type: 'bad' })
                        : addTracker(TAB_KIND[tab])
                  }
                >
                  {copy.add}
                </Button>
              )}
            </div>

            {tab === 'today' ? (
              <TodayTab
                today={today}
                unanswered={locked ? 0 : unanswered}
                onEditDomain={(domain) => setDialog({ type: 'domain', domain })}
                onAddSkill={(domainId) => addTracker('skill', domainId)}
                onOpenBadHabits={() => setTab('bad')}
              />
            ) : tab === 'bad' ? (
              locked ? (
                <LockScreen />
              ) : badHabits.length === 0 ? (
                <p className={styles.empty}>{copy.empty}</p>
              ) : (
                <ul className={styles.cards}>
                  {badHabits.map((habit) => (
                    <BadHabitCard key={habit.id} habit={habit} />
                  ))}
                </ul>
              )
            ) : tab === 'domains' ? (
              domains.length === 0 ? (
                <p className={styles.empty}>{copy.empty}</p>
              ) : (
                <ul>
                  {domains.map((domain) => (
                    <DomainPanel
                      key={domain.id}
                      domain={domain}
                      onEdit={() => setDialog({ type: 'domain', domain })}
                      onAddSkill={() => addTracker('skill', domain.id)}
                    />
                  ))}
                </ul>
              )
            ) : lists[tab].length === 0 ? (
              <p className={styles.empty}>{copy.empty}</p>
            ) : (
              <ul className={styles.cards}>
                {lists[tab].map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </ul>
            )}
          </TrackerTabs>
        </section>
      </div>
      {dialogs}
    </>
  );
}
