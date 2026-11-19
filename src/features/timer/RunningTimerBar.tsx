import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { buildSchedule } from '../../domain/pomodoro';
import { Clock } from './Clock';
import styles from './RunningTimerBar.module.css';
import { useCountdownCompletion } from './useCountdownCompletion';
import { useTimer } from './useTimer';

/** Shown on every page while a timer runs, so it can't be forgotten. */
export function RunningTimerBar() {
  useCountdownCompletion();
  const { activeTimer, activeSkill, paused, phase, pause, resume, stop, discard, nextRound } =
    useTimer();
  if (!activeTimer || !activeSkill) return null;
  const round = (activeTimer.pomodoro?.round ?? 0) + 1;
  const total =
    activeTimer.pomodoro && activeTimer.durationSeconds !== null
      ? buildSchedule(activeTimer.durationSeconds, activeTimer.pomodoro.plan).length
      : 0;

  return (
    <div
      className={styles.bar}
      data-color={activeSkill.color}
      data-paused={paused || (phase !== null && phase !== 'focus')}
    >
      <span className={styles.pulse} aria-hidden="true" />
      <Link to={`/skills/${activeSkill.id}`} className={styles.name}>
        <span aria-hidden="true">{activeSkill.icon}</span> {activeSkill.name}
      </Link>
      <Clock timer={activeTimer} className={styles.clock} />
      <span className={styles.left}>
        {paused
          ? 'paused'
          : phase === 'focus'
            ? `left in round ${round}/${total}`
            : phase === 'break'
              ? 'break'
              : phase === 'ready'
                ? 'break over'
                : activeTimer.durationSeconds !== null
                  ? 'left'
                  : ''}
      </span>
      {phase === 'break' || phase === 'ready' ? (
        <div className={styles.actions}>
          <Button
            size="sm"
            variant={phase === 'ready' ? 'primary' : 'secondary'}
            onClick={nextRound}
          >
            {phase === 'ready' ? `Start round ${round}` : 'Skip break'}
          </Button>
          <Button size="sm" onClick={stop}>
            Stop and save
          </Button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button size="sm" variant="quiet" onClick={discard}>
            Discard
          </Button>
          <Button size="sm" onClick={paused ? resume : pause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button size="sm" variant="primary" onClick={stop}>
            Stop and save
          </Button>
        </div>
      )}
    </div>
  );
}
