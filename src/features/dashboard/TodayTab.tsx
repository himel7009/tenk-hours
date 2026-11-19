import { Button } from '../../components/Button';
import { weekdayOf, isPlannedOn } from '../../domain/routine';
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

  const plannedDomains = domains.filter((domain) => isPlannedOn(domain.routineDays, today));
  const restingDomains = domains.filter((domain) => !isPlannedOn(domain.routineDays, today));
  const plannedOwn = skills.filter(
    (skill) => skill.domainId === null && isPlannedOn(skill.routineDays, today),
  );
  const weekday = new Date(2023, 0, 1 + weekdayOf(today)).toLocaleDateString(undefined, {
    weekday: 'long',
  });
  const nothingPlanned = plannedDomains.length === 0 && plannedOwn.length === 0;

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
        <h2 className={styles.todayHeading}>Planned for {weekday}</h2>
        {restingDomains.length > 0 && (
          <p className={styles.todayRest}>
            Not today: {restingDomains.map((domain) => `${domain.icon} ${domain.name}`).join(', ')}
          </p>
        )}
      </div>

      {nothingPlanned ? (
        <p className={styles.empty}>
          Nothing on your routine for {weekday}. Take the day off, or pick something from the other
          tabs. Time you put in still counts.
        </p>
      ) : (
        <>
          {plannedDomains.length > 0 && (
            <ul>
              {plannedDomains.map((domain) => (
                <DomainPanel
                  key={domain.id}
                  domain={domain}
                  onEdit={() => onEditDomain(domain)}
                  onAddSkill={() => onAddSkill(domain.id)}
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
