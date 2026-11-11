import { useState } from 'react';
import { Button } from '../../components/Button';
import { addDays, fromDayKey } from '../../domain/dates';
import { formatDuration } from '../../domain/format';
import { useTrackerStore } from '../../store/trackerStore';
import { StreakBadge } from '../progress/StreakBadge';
import { useToday } from '../progress/useNow';
import { useOverallProgress } from '../progress/useProgress';
import { SkillFormDialog } from './SkillFormDialog';
import styles from './SkillListPage.module.css';
import { SkillRow } from './SkillRow';

export function SkillListPage() {
  const skills = useTrackerStore((state) => state.skills);
  const [adding, setAdding] = useState(false);

  return (
    <>
      {skills.length === 0 ? (
        <section className={styles.welcome}>
          <h1 className={styles.headline}>Ten thousand hours, counted one at a time.</h1>
          <p className={styles.lede}>
            Pick a skill you want to get seriously good at. Time what you practise, or log it
            afterwards, and watch the hours add up.
          </p>
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add your first skill
          </Button>
        </section>
      ) : (
        <>
          <TodaySummary />
          <section>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Skills</h2>
              <Button onClick={() => setAdding(true)}>Add skill</Button>
            </div>
            <ul className={styles.list}>
              {skills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </ul>
          </section>
        </>
      )}

      {adding && <SkillFormDialog onClose={() => setAdding(false)} />}
    </>
  );
}

function TodaySummary() {
  const today = useToday();
  const { minutesToday, streak, byDay } = useOverallProgress();
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  return (
    <section className={styles.today}>
      <div>
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
      </div>

      <div className={styles.week}>
        <StreakBadge streak={streak} />
        <ol className={styles.weekDays} aria-label="Last 7 days">
          {week.map((day) => {
            const active = byDay.has(day);
            const weekday = fromDayKey(day).toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <li key={day} className={styles.weekDay} data-active={active}>
                <span className={styles.weekCell} />
                <span aria-hidden="true">{weekday.slice(0, 1)}</span>
                <span className="visually-hidden">
                  {weekday}: {active ? 'practised' : 'no practice'}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
