import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { Clock } from './Clock';
import styles from './RunningTimerBar.module.css';
import { useTimer } from './useTimer';

/** Shown on every page while a timer runs, so it can't be forgotten. */
export function RunningTimerBar() {
  const { activeTimer, activeSkill, stop, discard } = useTimer();
  if (!activeTimer || !activeSkill) return null;

  return (
    <div className={styles.bar} data-color={activeSkill.color}>
      <span className={styles.pulse} aria-hidden="true" />
      <Link to={`/skills/${activeSkill.id}`} className={styles.name}>
        {activeSkill.name}
      </Link>
      <Clock startedAt={activeTimer.startedAt} className={styles.clock} />
      <div className={styles.actions}>
        <Button size="sm" variant="quiet" onClick={discard}>
          Discard
        </Button>
        <Button size="sm" variant="primary" onClick={stop}>
          Stop and save
        </Button>
      </div>
    </div>
  );
}
