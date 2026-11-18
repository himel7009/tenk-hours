import { useState } from 'react';
import { Button } from '../../components/Button';
import { formatDuration, formatSeconds } from '../../domain/format';
import { elapsedMs } from '../../domain/timer';
import type { ActiveTimer, Skill } from '../../domain/types';
import { useNow } from '../progress/useNow';
import { Clock } from './Clock';
import styles from './TimerPanel.module.css';
import { useTimer } from './useTimer';

const PRESET_MINUTES = [25, 50, 60, 120];
const MAX_SECONDS = 24 * 60 * 60;
/** Sessions are saved in whole minutes, so a shorter countdown would save nothing. */
const MIN_SECONDS = 60;

type Choice = number | 'custom' | 'open';

interface TimerPanelProps {
  skill: Skill;
}

export function TimerPanel({ skill }: TimerPanelProps) {
  const { activeTimer, activeSkill, paused, start, pause, resume, stop, discard } = useTimer();

  if (activeTimer?.skillId === skill.id) {
    return (
      <div className={styles.panel}>
        <div>
          <Clock timer={activeTimer} className={styles.clock} />
          <p className={styles.caption}>
            {paused
              ? 'Paused. The time you are away does not count. Resume when you are back.'
              : activeTimer.durationSeconds === null
                ? 'Counting up until you stop'
                : `Left of ${formatSeconds(activeTimer.durationSeconds)}. Saves itself when it ends.`}
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant={paused ? 'primary' : 'secondary'} onClick={paused ? resume : pause}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant={paused ? 'secondary' : 'primary'} onClick={stop}>
            Stop and save
          </Button>
          <Button variant="quiet" onClick={discard}>
            Discard
          </Button>
        </div>
        {activeTimer.durationSeconds !== null && <CountdownBar timer={activeTimer} />}
      </div>
    );
  }

  return (
    <TimerSetup
      skill={skill}
      blockedBy={activeTimer ? (activeSkill?.name ?? 'something else') : null}
      onStart={(seconds) => start(skill.id, seconds)}
    />
  );
}

interface TimerSetupProps {
  skill: Skill;
  /** Name of whatever already has a timer running, if anything. */
  blockedBy: string | null;
  onStart: (durationSeconds: number | null) => void;
}

function TimerSetup({ skill, blockedBy, onStart }: TimerSetupProps) {
  // The daily goal is always offered, since finishing it keeps the streak.
  const presets = [...new Set([...PRESET_MINUTES, skill.dailyGoalMinutes])].sort((a, b) => a - b);
  const [choice, setChoice] = useState<Choice>(skill.dailyGoalMinutes);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');

  const parts = [customHours, customMinutes, customSeconds].map((value) => Number(value || 0));
  const [h = 0, m = 0, sec = 0] = parts;
  const customTotal = h * 3600 + m * 60 + sec;
  const customValid =
    parts.every((part) => Number.isInteger(part) && part >= 0) &&
    customTotal >= MIN_SECONDS &&
    customTotal <= MAX_SECONDS;
  const customTooShort = choice === 'custom' && customTotal > 0 && customTotal < MIN_SECONDS;
  // Presets are in minutes; everything from here on is in seconds.
  const duration = choice === 'open' ? null : choice === 'custom' ? customTotal : choice * 60;
  const canStart = blockedBy === null && (choice !== 'custom' || customValid);

  const options: { value: Choice; label: string }[] = [
    ...presets.map((minutes) => ({ value: minutes, label: formatDuration(minutes) })),
    { value: 'custom', label: 'Custom' },
    { value: 'open', label: 'No limit' },
  ];

  return (
    <div className={styles.setup}>
      <fieldset className={styles.durations}>
        <legend>Set a timer for</legend>
        {options.map(({ value, label }) => (
          <label key={value} className={styles.chip}>
            <input
              type="radio"
              name={`duration-${skill.id}`}
              className="visually-hidden"
              checked={choice === value}
              onChange={() => setChoice(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {choice === 'custom' && (
        <div className={styles.custom}>
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              placeholder="0"
              aria-label="Timer hours"
              value={customHours}
              onChange={(event) => setCustomHours(event.target.value)}
            />{' '}
            h
          </label>
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              placeholder="0"
              aria-label="Timer minutes"
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
            />{' '}
            min
          </label>
          <label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              placeholder="0"
              aria-label="Timer seconds"
              value={customSeconds}
              onChange={(event) => setCustomSeconds(event.target.value)}
            />{' '}
            sec
          </label>
        </div>
      )}

      <Button variant="primary" disabled={!canStart} onClick={() => onStart(duration)}>
        {duration === null
          ? 'Start stopwatch'
          : choice === 'custom' && !customValid
            ? 'Start timer'
            : `Start ${formatSeconds(duration)} timer`}
      </Button>

      <p className={styles.caption}>
        {blockedBy !== null
          ? `A timer is running for ${blockedBy}. Stop it to start one here.`
          : customTooShort
            ? 'Set at least a minute. Sessions are saved in whole minutes.'
            : duration === null
              ? 'Counts up until you stop it.'
              : 'Counts down and saves the session when it ends. Stop early to save what you did.'}
      </p>
    </div>
  );
}

function CountdownBar({ timer }: { timer: ActiveTimer }) {
  const now = useNow(1000);
  const total = (timer.durationSeconds ?? 1) * 1000;
  const fraction = Math.min(1, elapsedMs(timer, now) / total);
  return (
    <div className={styles.countdown} aria-hidden="true">
      <div className={styles.countdownFill} style={{ width: `${fraction * 100}%` }} />
    </div>
  );
}
