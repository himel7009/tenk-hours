import { Button } from '../../components/Button';
import { usePersistentState } from '../../components/usePersistentState';
import type { DailyPlan, Domain } from '../../domain/domains';
import { hasDailyGoal, type Skill } from '../../domain/types';
import { formatDuration, formatHours } from '../../domain/format';
import { StreakBadge } from '../progress/StreakBadge';
import { useDomainProgress } from '../progress/useDashboard';
import { useToday } from '../progress/useNow';
import { WeekStrip } from '../progress/WeekStrip';
import { SkillCard } from '../skills/SkillCard';
import styles from './DomainPanel.module.css';

interface DomainPanelProps {
  domain: Domain;
  onEdit: () => void;
  onAddSkill: () => void;
}

/** "2 skills and 1 project", leaving out kinds there are none of. */
function describeContents(skills: Skill[]): string {
  const count = (kind: Skill['kind'], noun: string) => {
    const n = skills.filter((skill) => skill.kind === kind).length;
    return n === 0 ? null : `${n} ${noun}${n === 1 ? '' : 's'}`;
  };
  const parts = [count('skill', 'skill'), count('project', 'project')].filter(Boolean);
  return parts.length === 0 ? '0 skills' : parts.join(' and ');
}

/**
 * The domain's daily plan: one segment per skill, sized by its daily goal and
 * filled by today's time on it.
 */
function DailyPlanBar({ plan }: { plan: DailyPlan }) {
  const { items, totalMinutes, coveredMinutes, doneCount } = plan;
  return (
    <div className={styles.plan}>
      <div className={styles.planHead}>
        <p className={styles.blockTitle}>
          Daily plan <strong className="tabular">{formatDuration(totalMinutes)} a day</strong>
        </p>
        <p className={`tabular ${styles.planStatus}`}>
          {formatDuration(coveredMinutes)} of {formatDuration(totalMinutes)} covered today,{' '}
          {doneCount} of {items.length} skill{items.length === 1 ? '' : 's'} done
        </p>
      </div>
      <div className={styles.planBar} aria-hidden="true">
        {items.map((item) => (
          <span
            key={item.skill.id}
            className={styles.planSegment}
            data-color={item.skill.color}
            style={{ flexGrow: item.goalMinutes }}
          >
            <span
              className={styles.planFill}
              style={{ width: `${Math.min(1, item.minutesToday / item.goalMinutes) * 100}%` }}
            />
          </span>
        ))}
      </div>
      <ul className={styles.planItems}>
        {items.map(({ skill, goalMinutes, minutesToday, done }) => (
          <li key={skill.id} data-color={skill.color} data-done={done} className="tabular">
            <span aria-hidden="true">{skill.icon}</span>
            {skill.name}{' '}
            <span className={styles.planTime}>
              {formatDuration(minutesToday)} / {formatDuration(goalMinutes)}
            </span>
            {done && <span className={styles.planDone}>done</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A domain with its combined hours and streak, and the skills inside it. */
export function DomainPanel({ domain, onEdit, onAddSkill }: DomainPanelProps) {
  const today = useToday();
  const { skills, progress } = useDomainProgress(domain);
  const contributing = progress.shares.filter((share) => share.minutes > 0);
  const hasGoals = skills.some((skill) => hasDailyGoal(skill.kind));
  const [open, setOpen] = usePersistentState<boolean>(`tenk:domain-open:${domain.id}`, true);
  const { plan } = progress;

  return (
    <li className={styles.panel} data-color={domain.color}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          {domain.icon}
        </span>
        <div className={styles.heading}>
          <h3 className={styles.name}>{domain.name}</h3>
          <p className={`tabular ${styles.total}`}>
            <strong>{formatHours(progress.loggedMinutes)} hours</strong> across{' '}
            {describeContents(skills)}
          </p>
        </div>
        <div className={styles.streak}>
          {/* A domain of only projects has no goals, so no streak: show today's time. */}
          {hasGoals ? (
            <span className={styles.streakLine}>
              <StreakBadge streak={progress.streak} />
              {progress.streak.longest > progress.streak.current && (
                <span className={`tabular ${styles.longest}`}>
                  longest {progress.streak.longest}
                </span>
              )}
            </span>
          ) : (
            <span className={`tabular ${styles.today}`}>
              {progress.minutesToday > 0
                ? `${formatDuration(progress.minutesToday)} today`
                : 'Nothing today'}
            </span>
          )}
          <WeekStrip
            completedDays={hasGoals ? progress.completedDays : progress.activeDays}
            doneLabel={hasGoals ? undefined : 'worked on'}
            activeDays={progress.activeDays}
            today={today}
          />
        </div>
        <div className={styles.actions}>
          <Button size="sm" variant="quiet" onClick={onEdit}>
            Edit domain
          </Button>
          <Button size="sm" onClick={onAddSkill}>
            Add skill or project
          </Button>
        </div>
      </header>

      {plan.items.length > 0 && <DailyPlanBar plan={plan} />}

      {contributing.length > 0 && (
        <div className={styles.shares}>
          <p className={styles.blockTitle}>All time, by skill</p>
          <div className={styles.shareBar} aria-hidden="true">
            {contributing.map(({ skill, minutes }) => (
              <span
                key={skill.id}
                className={styles.shareSegment}
                data-color={skill.color}
                style={{ flexGrow: minutes }}
              />
            ))}
          </div>
          <ul className={styles.legend}>
            {contributing.map(({ skill, minutes }) => (
              <li key={skill.id} data-color={skill.color} className="tabular">
                <span className={styles.dot} aria-hidden="true" />
                {skill.name} {formatHours(minutes)}h
              </li>
            ))}
          </ul>
        </div>
      )}

      {skills.length > 0 && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
          {open ? 'Hide' : 'Show'} {describeContents(skills)}
        </button>
      )}

      {skills.length === 0 ? (
        <p className={styles.empty}>
          Nothing in this domain yet. Add a skill or project, or move an existing one here by
          editing it.
        </p>
      ) : (
        open && (
          <ul className={styles.skills}>
            {skills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </ul>
        )
      )}
    </li>
  );
}
