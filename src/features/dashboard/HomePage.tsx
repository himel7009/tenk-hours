import { useState } from 'react';
import { Button } from '../../components/Button';
import type { Domain, DomainId } from '../../domain/domains';
import type { TrackerKind } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { DomainFormDialog } from '../domains/DomainFormDialog';
import { DomainPanel } from '../domains/DomainPanel';
import { useDashboard } from '../progress/useDashboard';
import { useToday } from '../progress/useNow';
import { SkillCard } from '../skills/SkillCard';
import { SkillFormDialog } from '../skills/SkillFormDialog';
import styles from './HomePage.module.css';
import dashboardStyles from './dashboard.module.css';
import { DayCard, YearCard } from './TimeCards';
import { TodayCard } from './TodayCard';
import { WeekChart } from './WeekChart';

type DialogState =
  | { type: 'tracker'; kind: TrackerKind; domainId: DomainId | null }
  | { type: 'domain'; domain?: Domain }
  | null;

export function HomePage() {
  const today = useToday();
  const skills = useTrackerStore((state) => state.skills);
  const domains = useTrackerStore((state) => state.domains);
  const dashboard = useDashboard();
  const [dialog, setDialog] = useState<DialogState>(null);

  const addTracker = (kind: TrackerKind, domainId: DomainId | null = null) =>
    setDialog({ type: 'tracker', kind, domainId });

  const standalone = skills.filter((skill) => skill.kind === 'skill' && skill.domainId === null);
  const projects = skills.filter((skill) => skill.kind === 'project' && skill.domainId === null);
  const habits = skills.filter((skill) => skill.kind === 'habit');
  const isEmpty = skills.length === 0 && domains.length === 0;

  return (
    <>
      {isEmpty && (
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
      )}

      <div className={dashboardStyles.grid}>
        {!isEmpty && <TodayCard dashboard={dashboard} today={today} />}
        <DayCard />
        <YearCard />
        {!isEmpty && <WeekChart dashboard={dashboard} today={today} />}
      </div>

      {!isEmpty && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>Domains</h2>
                <p className={styles.sectionNote}>
                  Fields that group skills and projects. A domain's hours are the total of
                  everything in it.
                </p>
              </div>
              <Button onClick={() => setDialog({ type: 'domain' })}>Add domain</Button>
            </div>
            {domains.length === 0 ? (
              <p className={styles.empty}>
                No domains yet. Add one, such as AI, to group skills like machine learning and deep
                learning.
              </p>
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
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>Skills</h2>
                <p className={styles.sectionNote}>Skills that stand alone, outside any domain.</p>
              </div>
              <Button onClick={() => addTracker('skill')}>Add skill</Button>
            </div>
            {standalone.length === 0 ? (
              <p className={styles.empty}>No standalone skills yet.</p>
            ) : (
              <ul className={styles.cards}>
                {standalone.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>Projects</h2>
                <p className={styles.sectionNote}>
                  Work you just want to time. No target or streak, only the hours you put in.
                </p>
              </div>
              <Button onClick={() => addTracker('project')}>Add project</Button>
            </div>
            {projects.length === 0 ? (
              <p className={styles.empty}>No projects outside a domain yet.</p>
            ) : (
              <ul className={styles.cards}>
                {projects.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>Habits</h2>
                <p className={styles.sectionNote}>Things you want to do every day.</p>
              </div>
              <Button onClick={() => addTracker('habit')}>Add habit</Button>
            </div>
            {habits.length === 0 ? (
              <p className={styles.empty}>No habits yet.</p>
            ) : (
              <ul className={styles.cards}>
                {habits.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

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
}
