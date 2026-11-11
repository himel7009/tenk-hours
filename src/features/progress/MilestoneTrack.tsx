import { milestonesFor } from '../../domain/milestones';
import styles from './MilestoneTrack.module.css';

interface MilestoneTrackProps {
  loggedMinutes: number;
  targetHours: number;
}

export function MilestoneTrack({ loggedMinutes, targetHours }: MilestoneTrackProps) {
  return (
    <ol className={styles.track} aria-label="Milestones">
      {milestonesFor(targetHours).map((hours) => {
        const reached = loggedMinutes >= hours * 60;
        return (
          <li key={hours} className={styles.stop} data-reached={reached}>
            {hours.toLocaleString()}h
            <span className="visually-hidden">{reached ? ' reached' : ' not reached'}</span>
          </li>
        );
      })}
    </ol>
  );
}
