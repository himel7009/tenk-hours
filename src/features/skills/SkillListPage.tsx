import { useState } from 'react';
import { Button } from '../../components/Button';
import { fromDayKey } from '../../domain/dates';
import { formatDuration } from '../../domain/format';
import type { TrackerKind } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import { useMinutesToday } from '../progress/useProgress';
import { SkillFormDialog } from './SkillFormDialog';
import styles from './SkillListPage.module.css';
import { SkillRow } from './SkillRow';

const SECTIONS: { kind: TrackerKind; title: string; add: string; empty: string }[] = [
  {
    kind: 'skill',
    title: 'Skills',
    add: 'Add skill',
    empty: 'No skills yet. Add something you want to get seriously good at.',
  },
  {
    kind: 'habit',
    title: 'Habits',
    add: 'Add habit',
    empty: 'No habits yet. Add something you want to do every day.',
  },
];

export function SkillListPage() {
  const skills = useTrackerStore((state) => state.skills);
  const [adding, setAdding] = useState<TrackerKind | null>(null);

  return (
    <>
      {skills.length === 0 ? (
        <section className={styles.welcome}>
          <h1 className={styles.headline}>Ten thousand hours, counted one at a time.</h1>
          <p className={styles.lede}>
            Track a skill you want to master, or a habit you want to keep every day. Set a timer,
            put in the time, and keep your streak alive.
          </p>
          <div className={styles.welcomeActions}>
            <Button variant="primary" onClick={() => setAdding('skill')}>
              Add a skill
            </Button>
            <Button onClick={() => setAdding('habit')}>Add a habit</Button>
          </div>
        </section>
      ) : (
        <>
          <TodaySummary />
          {SECTIONS.map(({ kind, title, add, empty }) => {
            const rows = skills.filter((skill) => skill.kind === kind);
            return (
              <section key={kind} className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>{title}</h2>
                  <Button onClick={() => setAdding(kind)}>{add}</Button>
                </div>
                {rows.length === 0 ? (
                  <p className={styles.empty}>{empty}</p>
                ) : (
                  <ul>
                    {rows.map((skill) => (
                      <SkillRow key={skill.id} skill={skill} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      {adding && <SkillFormDialog kind={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function TodaySummary() {
  const today = useToday();
  const minutesToday = useMinutesToday();

  return (
    <section className={styles.today}>
      <p className={styles.date}>
        {fromDayKey(today).toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </p>
      <h1 className={styles.headline}>
        {minutesToday > 0 ? `${formatDuration(minutesToday)} today` : 'Nothing logged today yet'}
      </h1>
    </section>
  );
}
