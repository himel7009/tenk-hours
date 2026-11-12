import { useState } from 'react';
import { Button } from '../../components/Button';
import { formatDuration } from '../../domain/format';
import type { Skill } from '../../domain/types';
import { timerEndsAt } from '../../store/trackerStore';
import { useNow } from '../progress/useNow';
import { Clock } from './Clock';
import styles from './TimerPanel.module.css';
import { useTimer } from './useTimer';

const PRESET_MINUTES = [25, 50, 60, 120];
const MAX_MINUTES = 24 * 60;

type Choice = number | 'custom' | 'open';

interface TimerPanelProps {
  skill: Skill;
}

export function TimerPanel({ skill }: TimerPanelProps) {
  const { activeTimer, activeSkill, start, stop, discard } = useTimer();

  if (activeTimer?.skillId === skill.id) {
    return (
      <div className={styles.panel}>
        <div>
          <Clock timer={activeTimer} className={styles.clock} />
          <p className={styles.caption}>
            {activeTimer.durationMinutes === null
              ? 'Counting up until you stop'
              : `Left of ${formatDuration(activeTimer.durationMinutes)}. Saves itself when it ends.`}
          </p>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" onClick={stop}>
            Stop and save
          </Button>
          <Button variant="quiet" onClick={discard}>
            Discard
          </Button>
        </div>
        {activeTimer.durationMinutes !== null && (
          <CountdownBar startedAt={activeTimer.startedAt} endsAt={timerEndsAt(activeTimer)} />
        )}
      </div>
    );
  }

  return (
    <TimerSetup
      skill={skill}
      blockedBy={activeTimer ? (activeSkill?.name ?? 'something else') : null}
      onStart={(minutes) => start(skill.id, minutes)}
    />
  );
}

interface TimerSetupProps {
  skill: Skill;
  /** Name of whatever already has a timer running, if anything. */
  blockedBy: string | null;
  onStart: (durationMinutes: number | null) => void;
}

function TimerSetup({ skill, blockedBy, onStart }: TimerSetupProps) {
  // The daily goal is always offered, since finishing it keeps the streak.
  const presets = [...new Set([...PRESET_MINUTES, skill.dailyGoalMinutes])].sort((a, b) => a - b);
  const [choice, setChoice] = useState<Choice>(skill.dailyGoalMinutes);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');

  const customTotal = Number(customHours || 0) * 60 + Number(customMinutes || 0);
  const customValid =
    Number.isInteger(customTotal) && customTotal >= 1 && customTotal <= MAX_MINUTES;
  const duration = choice === 'open' ? null : choice === 'custom' ? customTotal : choice;
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
        </div>
      )}

      <Button variant="primary" disabled={!canStart} onClick={() => onStart(duration)}>
        {duration === null
          ? 'Start stopwatch'
          : `Start ${choice === 'custom' && !customValid ? '' : formatDuration(duration)} timer`}
      </Button>

      <p className={styles.caption}>
        {blockedBy !== null
          ? `A timer is running for ${blockedBy}. Stop it to start one here.`
          : duration === null
            ? 'Counts up until you stop it.'
            : 'Counts down and saves the session when it ends. Stop early to save what you did.'}
      </p>
    </div>
  );
}

function CountdownBar({ startedAt, endsAt }: { startedAt: number; endsAt: number }) {
  const now = useNow(1000);
  const fraction = Math.min(1, (now - startedAt) / (endsAt - startedAt));
  return (
    <div className={styles.countdown} aria-hidden="true">
      <div className={styles.countdownFill} style={{ width: `${fraction * 100}%` }} />
    </div>
  );
}
