import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import {
  buildDayPlan,
  isPlannedOn,
  planOf,
  routineOf,
  weekdayOf,
  type DayPlanRow,
} from '../../domain/routine';
import { ChangeDayDialog } from '../routine/ChangeDayDialog';
import type { DayKey } from '../../domain/dates';
import type { Domain, DomainId } from '../../domain/domains';
import { useTrackerStore } from '../../store/trackerStore';
import { DomainPanel } from '../domains/DomainPanel';
import { SkillCard } from '../skills/SkillCard';
import { TodoList } from '../todos/TodoList';
import styles from './HomePage.module.css';

interface TodayTabProps {
  today: DayKey;
  /** Bad habits still to answer today; zero while they are locked. */
  unanswered: number;
  onEditDomain: (domain: Domain) => void;
  onAddSkill: (domainId: DomainId) => void;
  onOpenBadHabits: () => void;
}

/**
 * The day in one place: the to-do list, then only the domains and trackers
 * the weekly routine plans for today. It changes by itself as the days go by.
 */
export function TodayTab({
  today,
  unanswered,
  onEditDomain,
  onAddSkill,
  onOpenBadHabits,
}: TodayTabProps) {
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);

  // A domain holding only projects has nothing left to show once they are listed above.
  const holdsMoreThanProjects = (domain: Domain) =>
    skills.some((skill) => skill.domainId === domain.id && skill.kind !== 'project');
  const plannedDomains = domains.filter(
    (domain) => isPlannedOn(planOf(domain), today) && holdsMoreThanProjects(domain),
  );
  const restingDomains = domains.filter((domain) => !isPlannedOn(planOf(domain), today));
  // Projects come first, wherever they sit: they are the daily work.
  const plannedProjects = skills.filter(
    (skill) => skill.kind === 'project' && isPlannedOn(routineOf(skill, domains), today),
  );
  const plannedOwn = skills.filter(
    (skill) =>
      skill.kind !== 'project' && skill.domainId === null && isPlannedOn(planOf(skill), today),
  );
  const weekday = new Date(2023, 0, 1 + weekdayOf(today)).toLocaleDateString(undefined, {
    weekday: 'long',
  });
  const [changing, setChanging] = useState(false);
  const dayPlan = useMemo(() => {
    const { on, off } = buildDayPlan(domains, skills, today);
    const names = (rows: DayPlanRow[]) => rows.map((row) => `${row.icon} ${row.name}`);
    return {
      added: names(on.filter((row) => row.state === 'added')),
      skipped: names(off.filter((row) => row.state === 'skipped')),
    };
  }, [domains, skills, today]);
  const nothingPlanned =
    plannedProjects.length === 0 && plannedDomains.length === 0 && plannedOwn.length === 0;

  return (
    <div className={styles.todayTab}>
      <TodoList />

      {unanswered > 0 && (
        <p className={styles.todayNudge}>
          {unanswered === 1 ? '1 bad habit' : `${unanswered} bad habits`} to answer today.{' '}
          <Button size="sm" variant="quiet" onClick={onOpenBadHabits}>
            Answer now
          </Button>
        </p>
      )}

      <div>
        <div className={styles.todayHead}>
          <h2 className={styles.todayHeading}>Planned for {weekday}</h2>
          <Button size="sm" variant="quiet" onClick={() => setChanging(true)}>
            Change today
          </Button>
        </div>
        {(dayPlan.added.length > 0 || dayPlan.skipped.length > 0) && (
          <p className={styles.todayChanges}>
            {dayPlan.added.length > 0 && (
              <>
                Added for today: <strong>{dayPlan.added.join(', ')}</strong>.{' '}
              </>
            )}
            {dayPlan.skipped.length > 0 && (
              <>
                Skipped today: <strong>{dayPlan.skipped.join(', ')}</strong>, streaks kept.
              </>
            )}
          </p>
        )}
        {restingDomains.length > 0 && (
          <p className={styles.todayRest}>
            Not today: {restingDomains.map((domain) => `${domain.icon} ${domain.name}`).join(', ')}
          </p>
        )}
      </div>
      {changing && <ChangeDayDialog onClose={() => setChanging(false)} />}

      {nothingPlanned ? (
        <p className={styles.empty}>
          Nothing on your plan for {weekday}. Take the day off, or use Change today to add
          something. Time you put in always counts.
        </p>
      ) : (
        <>
          {plannedProjects.length > 0 && (
            <section aria-labelledby="today-projects">
              <h3 id="today-projects" className={styles.todaySubheading}>
                Projects
              </h3>
              <ul className={styles.cards}>
                {plannedProjects.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} showDomain />
                ))}
              </ul>
            </section>
          )}
          {plannedDomains.length > 0 && (
            <ul>
              {plannedDomains.map((domain) => (
                <DomainPanel
                  key={domain.id}
                  domain={domain}
                  onEdit={() => onEditDomain(domain)}
                  onAddSkill={() => onAddSkill(domain.id)}
                  hideProjects
                />
              ))}
            </ul>
          )}
          {plannedOwn.length > 0 && (
            <ul className={styles.cards}>
              {plannedOwn.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
