import { useState } from 'react';
import { Button } from '../../components/Button';
import { usePersistentState } from '../../components/usePersistentState';
import type { Domain, DomainId } from '../../domain/domains';
import type { Skill, TrackerKind } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { DomainFormDialog } from '../domains/DomainFormDialog';
import { DomainPanel } from '../domains/DomainPanel';
import { useDashboard } from '../progress/useDashboard';
import { useToday } from '../progress/useNow';
import { SkillCard } from '../skills/SkillCard';
import { SkillFormDialog } from '../skills/SkillFormDialog';
import styles from './HomePage.module.css';
import { DayCard, YearCard } from './TimeCards';
import { TodayCard } from './TodayCard';
import { TrackerTabs } from './TrackerTabs';
import { WeekChart } from './WeekChart';

type DialogState =
  | { type: 'tracker'; kind: TrackerKind; domainId: DomainId | null }
  | { type: 'domain'; domain?: Domain }
  | null;

type TabId = 'domains' | 'skills' | 'projects' | 'habits';

const TAB_COPY: Record<TabId, { label: string; note: string; empty: string; add: string }> = {
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
};

const TAB_KIND: Record<Exclude<TabId, 'domains'>, TrackerKind> = {
  skills: 'skill',
  projects: 'project',
  habits: 'habit',
};

export function HomePage() {
  const today = useToday();
  const skills = useTrackerStore((state) => state.skills);
  const domains = useTrackerStore((state) => state.domains);
  const dashboard = useDashboard();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [tab, setTab] = usePersistentState<TabId>('tenk:home-tab', 'domains');

  const addTracker = (kind: TrackerKind, domainId: DomainId | null = null) =>
    setDialog({ type: 'tracker', kind, domainId });

  const lists: Record<Exclude<TabId, 'domains'>, Skill[]> = {
    skills: skills.filter((skill) => skill.kind === 'skill' && skill.domainId === null),
    projects: skills.filter((skill) => skill.kind === 'project' && skill.domainId === null),
    habits: skills.filter((skill) => skill.kind === 'habit'),
  };
  const isEmpty = skills.length === 0 && domains.length === 0;
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
          <div className={styles.insights}>
            <div className={styles.timePair}>
              <DayCard />
              <YearCard />
            </div>
            <WeekChart dashboard={dashboard} today={today} />
          </div>
        </aside>

        <section className={styles.trackers} aria-label="Your trackers">
          <TrackerTabs
            tabs={[
              { id: 'domains', label: 'Domains', count: domains.length },
              { id: 'skills', label: 'Skills', count: lists.skills.length },
              { id: 'projects', label: 'Projects', count: lists.projects.length },
              { id: 'habits', label: 'Habits', count: lists.habits.length },
            ]}
            selected={tab}
            onSelect={setTab}
          >
            <div className={styles.panelHead}>
              <p className={styles.note}>{copy.note}</p>
              <Button
                onClick={() =>
                  tab === 'domains' ? setDialog({ type: 'domain' }) : addTracker(TAB_KIND[tab])
                }
              >
                {copy.add}
              </Button>
            </div>

            {tab === 'domains' ? (
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
