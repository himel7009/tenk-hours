import { Button } from '../../components/Button';
import type { Skill } from '../../domain/types';
import { Clock } from './Clock';
import styles from './TimerPanel.module.css';
import { useTimer } from './useTimer';

interface TimerPanelProps {
  skill: Skill;
}

export function TimerPanel({ skill }: TimerPanelProps) {
  const { activeTimer, activeSkill, start, stop, discard } = useTimer();
  const runningHere = activeTimer?.skillId === skill.id;

  if (activeTimer && runningHere) {
    return (
      <div className={styles.panel}>
        <Clock startedAt={activeTimer.startedAt} className={styles.clock} />
        <div className={styles.actions}>
          <Button variant="primary" onClick={stop}>
            Stop and save
          </Button>
          <Button variant="quiet" onClick={discard}>
            Discard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <span className={`tabular ${styles.clock} ${styles.idle}`}>0:00:00</span>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => start(skill.id)} disabled={Boolean(activeTimer)}>
          Start timer
        </Button>
      </div>
      {activeTimer && (
        <p className={styles.note}>
          A timer is running for {activeSkill?.name ?? 'another skill'}. Stop it to start one here.
        </p>
      )}
    </div>
  );
}
