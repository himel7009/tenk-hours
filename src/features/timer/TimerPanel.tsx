import { useState } from 'react';
import { Button } from '../../components/Button';
import { formatDuration, formatSeconds } from '../../domain/format';
import {
  buildSchedule,
  pomodoroView,
  scheduleLengthSeconds,
  type PomodoroPlan,
} from '../../domain/pomodoro';
import { elapsedMs } from '../../domain/timer';
import type { ActiveTimer, Skill } from '../../domain/types';
import { useNow } from '../progress/useNow';
import { Clock } from './Clock';
import { RoundsTrack } from './RoundsTrack';
import styles from './TimerPanel.module.css';
import { usePomodoroPlan, type PomodoroChoice } from './usePomodoroPlan';
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

  if (activeTimer?.skillId === skill.id && activeTimer.pomodoro) {
    return <PomodoroPanel timer={activeTimer} />;
  }

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
      onStart={(seconds, plan) => start(skill.id, seconds, plan)}
    />
  );
}

interface TimerSetupProps {
  skill: Skill;
  /** Name of whatever already has a timer running, if anything. */
  blockedBy: string | null;
  onStart: (durationSeconds: number | null, plan: PomodoroPlan | null) => void;
}

function TimerSetup({ skill, blockedBy, onStart }: TimerSetupProps) {
  // The daily goal is always offered, since finishing it keeps the streak.
  // Projects have no goal and start as a stopwatch: work until you stop.
  const isProject = skill.kind === 'project';
  const presets = isProject
    ? PRESET_MINUTES
    : [...new Set([...PRESET_MINUTES, skill.dailyGoalMinutes])].sort((a, b) => a - b);
  const [choice, setChoice] = useState<Choice>(isProject ? 'open' : skill.dailyGoalMinutes);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');
  const pomodoro = usePomodoroPlan();

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
  // Rounds need a length to split, so a stopwatch never has them.
  const plan = duration === null ? null : pomodoro.plan;
  const rounds = plan && duration !== null && canStart ? buildSchedule(duration, plan) : [];

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

      {duration !== null && (
        <fieldset className={styles.durations}>
          <legend>Work in rounds</legend>
          {POMODORO_CHOICES.map(({ value, label }) => (
            <label key={value} className={styles.chip}>
              <input
                type="radio"
                name={`pomodoro-${skill.id}`}
                className="visually-hidden"
                checked={pomodoro.choice === value}
                onChange={() => pomodoro.setChoice(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      {rounds.length > 0 && <SchedulePreview rounds={rounds} />}

      <Button variant="primary" disabled={!canStart} onClick={() => onStart(duration, plan)}>
        {duration === null
          ? 'Start stopwatch'
          : choice === 'custom' && !customValid
            ? 'Start timer'
            : rounds.length > 1
              ? `Start ${formatSeconds(duration)} in ${rounds.length} rounds`
              : `Start ${formatSeconds(duration)} timer`}
      </Button>

      <p className={styles.caption}>
        {blockedBy !== null
          ? `A timer is running for ${blockedBy}. Stop it to start one here.`
          : customTooShort
            ? 'Set at least a minute. Sessions are saved in whole minutes.'
            : duration === null
              ? 'Counts up until you stop it.'
              : rounds.length > 0
                ? 'Only focus time is saved. Breaks never count.'
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

const POMODORO_CHOICES: { value: PomodoroChoice; label: string }[] = [
  { value: 'off', label: 'Straight through' },
  { value: 'classic', label: '25 min + 5 break' },
  { value: 'long', label: '50 min + 10 break' },
];

function finishTime(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SchedulePreview({ rounds }: { rounds: ReturnType<typeof buildSchedule> }) {
  const breaks = rounds.filter((round) => round.breakSeconds > 0);
  const breakMinutes = breaks.reduce((sum, round) => sum + round.breakSeconds, 0) / 60;
  return (
    <div className={styles.preview}>
      <RoundsTrack rounds={rounds} />
      <p className={styles.caption}>
        {rounds.length === 1
          ? 'Short enough for one round, no break needed.'
          : `${rounds.length} rounds and ${breaks.length} ${breaks.length === 1 ? 'break' : 'breaks'} (${formatDuration(breakMinutes)} in all). If you start now and take every break, you finish around ${finishTime(scheduleLengthSeconds(rounds))}.`}
      </p>
    </div>
  );
}

/** A running Pomodoro session: the round or break on the clock, and what comes next. */
function PomodoroPanel({ timer }: { timer: ActiveTimer }) {
  const { paused, phase, pause, resume, stop, discard, nextRound } = useTimer();
  const now = useNow(1000);
  const view = pomodoroView(timer, now);
  if (!view) return null;
  const total = view.rounds.length;
  const roundNumber = view.round + 1;
  const breakSeconds = view.rounds[view.round - 1]?.breakSeconds ?? 0;

  return (
    <div className={styles.panel} data-phase={phase}>
      <div>
        <p className={styles.phase}>
          {phase === 'focus'
            ? `Round ${roundNumber} of ${total}`
            : phase === 'break'
              ? `${breakSeconds >= 15 * 60 ? 'Long break' : 'Break'} before round ${roundNumber}`
              : `Round ${roundNumber} of ${total} is ready`}
        </p>
        <Clock timer={timer} className={styles.clock} />
        <p className={styles.caption}>
          {phase === 'break'
            ? 'Step away. Break time does not count.'
            : phase === 'ready'
              ? 'The break is over. The clock waits for you, so nothing counts until you start.'
              : paused
                ? 'Paused. The time you are away does not count.'
                : `${formatDuration(Math.round(view.focusedMs / 60_000))} of ${formatSeconds(timer.durationSeconds ?? 0)} focused`}
        </p>
      </div>
      <div className={styles.actions}>
        {phase === 'focus' ? (
          <>
            <Button variant={paused ? 'primary' : 'secondary'} onClick={paused ? resume : pause}>
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant={paused ? 'secondary' : 'primary'} onClick={stop}>
              Stop and save
            </Button>
            <Button variant="quiet" onClick={discard}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <Button variant={phase === 'ready' ? 'primary' : 'secondary'} onClick={nextRound}>
              {phase === 'ready' ? `Start round ${roundNumber}` : 'Skip break'}
            </Button>
            <Button variant="secondary" onClick={stop}>
              Stop and save
            </Button>
          </>
        )}
      </div>
      <div className={styles.track}>
        <RoundsTrack rounds={view.rounds} focusedMs={view.focusedMs} current={view.round} />
      </div>
    </div>
  );
}
