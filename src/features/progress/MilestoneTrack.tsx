import type { Milestone } from '../../domain/milestones';
import styles from './MilestoneTrack.module.css';

interface MilestoneTrackProps {
  milestones: Milestone[];
}

export function MilestoneTrack({ milestones }: MilestoneTrackProps) {
  return (
    <ol className={styles.track} aria-label="Milestones">
      {milestones.map(({ label, reached }) => (
        <li key={label} className={styles.stop} data-reached={reached}>
          {label}
          <span className="visually-hidden">{reached ? ' reached' : ' not reached'}</span>
        </li>
      ))}
    </ol>
  );
}
