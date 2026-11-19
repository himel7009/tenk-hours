import { clockMs, elapsedMs, resume } from './timer';
import type { ActiveTimer } from './types';

/** How focus time is split up. */
export interface PomodoroPlan {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  /** A long break comes after every this many rounds. */
  longBreakEvery: number;
}

export type PomodoroPlanId = 'classic' | 'long';

export const POMODORO_PLANS: Record<PomodoroPlanId, PomodoroPlan> = {
  classic: { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
  long: { focusMinutes: 50, breakMinutes: 10, longBreakMinutes: 20, longBreakEvery: 2 },
};

/**
 * `focus`: a round is running. `break`: the focus clock is stopped while the
 * break counts down. `ready`: the break is over and the next round waits for
 * you, so time away from the desk is never counted.
 */
export type PomodoroPhase = 'focus' | 'break' | 'ready';

export interface PomodoroState {
  plan: PomodoroPlan;
  phase: PomodoroPhase;
  /** The round in progress, or the next one during a break. Zero-based. */
  round: number;
  breakEndsAt: number | null;
}

export interface Round {
  focusSeconds: number;
  /** The break after this round; zero after the last one. */
  breakSeconds: number;
  /** Focus time from the start of the session to the end of this round. */
  endSeconds: number;
}

/**
 * Splits the focus time into rounds of the plan's length, with the leftover
 * as a shorter last round. A leftover under 5 minutes is folded into the last
 * full round instead of making a round too short to be worth starting.
 */
export function buildSchedule(totalSeconds: number, plan: PomodoroPlan): Round[] {
  const roundSeconds = plan.focusMinutes * 60;
  const lengths: number[] = [];
  let left = totalSeconds;
  while (left > 0) {
    lengths.push(Math.min(roundSeconds, left));
    left -= roundSeconds;
  }
  const last = lengths.at(-1);
  if (lengths.length > 1 && last !== undefined && last < 5 * 60) {
    lengths.pop();
    lengths[lengths.length - 1]! += last;
  }

  let end = 0;
  return lengths.map((focusSeconds, index) => {
    end += focusSeconds;
    const isLast = index === lengths.length - 1;
    const isLong = (index + 1) % plan.longBreakEvery === 0;
    const breakMinutes = isLong ? plan.longBreakMinutes : plan.breakMinutes;
    return { focusSeconds, breakSeconds: isLast ? 0 : breakMinutes * 60, endSeconds: end };
  });
}

/** Focus plus breaks: how long the whole session takes if nothing is paused. */
export function scheduleLengthSeconds(rounds: Round[]): number {
  return rounds.reduce((sum, round) => sum + round.focusSeconds + round.breakSeconds, 0);
}

function roundsOf(timer: ActiveTimer): Round[] {
  return timer.pomodoro && timer.durationSeconds !== null
    ? buildSchedule(timer.durationSeconds, timer.pomodoro.plan)
    : [];
}

/** When the session next changes phase by itself. Infinity if it is waiting. */
export function nextPomodoroEvent(timer: ActiveTimer): number {
  const state = timer.pomodoro;
  if (!state) return Infinity;
  if (state.phase === 'break') return state.breakEndsAt ?? Infinity;
  if (state.phase === 'ready' || timer.pausedAt !== null) return Infinity;
  const round = roundsOf(timer)[state.round];
  return round ? timer.startedAt + timer.pausedMs + round.endSeconds * 1000 : Infinity;
}

export type PomodoroEvent = 'break' | 'ready' | 'done' | null;

/**
 * Moves the session on to wherever it should be at `now`: a finished round
 * starts its break, and a finished break waits for the next round. Works the
 * same if the app was closed through several of these, since focus stops at
 * the end of the round it was in.
 */
export function advancePomodoro(
  timer: ActiveTimer,
  now: number,
): { timer: ActiveTimer; event: PomodoroEvent } {
  const state = timer.pomodoro;
  if (!state) return { timer, event: null };
  const rounds = roundsOf(timer);
  const round = rounds[state.round];

  if (state.phase === 'focus' && timer.pausedAt === null && round) {
    if (elapsedMs(timer, now) < round.endSeconds * 1000) return { timer, event: null };
    if (state.round === rounds.length - 1) return { timer, event: 'done' };

    // Focus stopped the moment the round ended, not when we noticed.
    const roundEndedAt = timer.startedAt + timer.pausedMs + round.endSeconds * 1000;
    const onBreak: ActiveTimer = {
      ...timer,
      pausedAt: roundEndedAt,
      pomodoro: {
        ...state,
        phase: 'break',
        round: state.round + 1,
        breakEndsAt: roundEndedAt + round.breakSeconds * 1000,
      },
    };
    const after = advancePomodoro(onBreak, now);
    return { timer: after.timer, event: after.event ?? 'break' };
  }

  if (state.phase === 'break' && state.breakEndsAt !== null && now >= state.breakEndsAt) {
    return {
      timer: { ...timer, pomodoro: { ...state, phase: 'ready', breakEndsAt: null } },
      event: 'ready',
    };
  }

  return { timer, event: null };
}

/** Ends the break early or starts the next round after it. */
export function startNextRound(timer: ActiveTimer, now: number): ActiveTimer {
  const state = timer.pomodoro;
  if (!state || state.phase === 'focus') return timer;
  return { ...resume(timer, now), pomodoro: { ...state, phase: 'focus', breakEndsAt: null } };
}

export interface PomodoroView {
  rounds: Round[];
  round: number;
  phase: PomodoroPhase;
  /** What the clock shows: time left in this round, or in the break. */
  clockMs: number;
  focusedMs: number;
}

export function pomodoroView(timer: ActiveTimer, now: number): PomodoroView | null {
  const state = timer.pomodoro;
  if (!state) return null;
  const rounds = roundsOf(timer);
  const focusedMs = elapsedMs(timer, now);
  const round = rounds[state.round];
  const clockMs =
    state.phase === 'break'
      ? Math.max(0, (state.breakEndsAt ?? now) - now)
      : state.phase === 'ready'
        ? (round?.focusSeconds ?? 0) * 1000
        : Math.max(0, (round?.endSeconds ?? 0) * 1000 - focusedMs);
  return { rounds, round: state.round, phase: state.phase, clockMs, focusedMs };
}

/** What a timer's clock shows: the round or break for Pomodoro, else the usual. */
export function displayClockMs(timer: ActiveTimer, now: number): number {
  return pomodoroView(timer, now)?.clockMs ?? clockMs(timer, now);
}
