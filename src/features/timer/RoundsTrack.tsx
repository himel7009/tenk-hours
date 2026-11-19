import type { Round } from '../../domain/pomodoro';
import styles from './RoundsTrack.module.css';

interface RoundsTrackProps {
  rounds: Round[];
  /** Focus done so far, in ms. Leave out for a preview. */
  focusedMs?: number;
  /** The round in progress, highlighted. */
  current?: number;
}

/**
 * The session laid out in time: a segment per round, sized by its focus
 * time, with a gap sized by the break after it. Breaks stay empty because
 * they never count.
 */
export function RoundsTrack({ rounds, focusedMs = 0, current }: RoundsTrackProps) {
  return (
    <div className={styles.track} aria-hidden="true">
      {rounds.map((round, index) => {
        const startMs = (round.endSeconds - round.focusSeconds) * 1000;
        const fill = Math.min(1, Math.max(0, (focusedMs - startMs) / (round.focusSeconds * 1000)));
        return (
          <div key={index} className={styles.slot} style={{ flexGrow: round.focusSeconds }}>
            <div className={styles.round} data-current={index === current}>
              <div className={styles.fill} style={{ width: `${fill * 100}%` }} />
            </div>
            {round.breakSeconds > 0 && (
              <div
                className={styles.break}
                style={{ width: `${round.breakSeconds / 60 / 4}rem` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
