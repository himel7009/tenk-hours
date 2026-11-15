import { Button } from '../../components/Button';
import type { Domain } from '../../domain/domains';
import { formatHours } from '../../domain/format';
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

/** A domain with its combined hours and streak, and the skills inside it. */
export function DomainPanel({ domain, onEdit, onAddSkill }: DomainPanelProps) {
  const today = useToday();
  const { skills, progress } = useDomainProgress(domain);
  const contributing = progress.shares.filter((share) => share.minutes > 0);

  return (
    <li className={styles.panel} data-color={domain.color}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          {domain.icon}
        </span>
        <div className={styles.heading}>
          <h3 className={styles.name}>{domain.name}</h3>
          <p className={`tabular ${styles.total}`}>
            <strong>{formatHours(progress.loggedMinutes)} hours</strong> across {skills.length}{' '}
            skill{skills.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className={styles.streak}>
          <StreakBadge streak={progress.streak} />
          <WeekStrip
            completedDays={progress.completedDays}
            activeDays={progress.activeDays}
            today={today}
          />
        </div>
        <div className={styles.actions}>
          <Button size="sm" variant="quiet" onClick={onEdit}>
            Edit domain
          </Button>
          <Button size="sm" onClick={onAddSkill}>
            Add skill
          </Button>
        </div>
      </header>

      {contributing.length > 0 && (
        <div className={styles.shares}>
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

      {skills.length === 0 ? (
        <p className={styles.empty}>
          No skills in this domain yet. Add one, or move an existing skill here by editing it.
        </p>
      ) : (
        <ul className={styles.skills}>
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </ul>
      )}
    </li>
  );
}
