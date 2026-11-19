import { describe, expect, it } from 'vitest';
import {
  advancePomodoro,
  buildSchedule,
  nextPomodoroEvent,
  pomodoroView,
  POMODORO_PLANS,
  scheduleLengthSeconds,
  startNextRound,
} from './pomodoro';
import { elapsedMs, pause, resume } from './timer';
import type { ActiveTimer } from './types';

const MIN = 60_000;
const classic = POMODORO_PLANS.classic;

const session = (focusMinutes: number): ActiveTimer => ({
  skillId: 's',
  startedAt: 0,
  durationSeconds: focusMinutes * 60,
  pausedAt: null,
  pausedMs: 0,
  pomodoro: { plan: classic, phase: 'focus', round: 0, breakEndsAt: null },
});

describe('buildSchedule', () => {
  it('splits 2 hours into four 25 minute rounds and a 20 minute one', () => {
    const rounds = buildSchedule(120 * 60, classic);
    expect(rounds.map((r) => r.focusSeconds / 60)).toEqual([25, 25, 25, 25, 20]);
    // A long break after the fourth round, none after the last.
    expect(rounds.map((r) => r.breakSeconds / 60)).toEqual([5, 5, 5, 15, 0]);
    expect(scheduleLengthSeconds(rounds) / 60).toBe(150);
  });

  it('grows with the total: 5 hours is twelve rounds', () => {
    const rounds = buildSchedule(5 * 3600, classic);
    expect(rounds).toHaveLength(12);
    expect(rounds.at(-1)?.endSeconds).toBe(5 * 3600);
  });

  it('folds a leftover under 5 minutes into the last round', () => {
    expect(buildSchedule(53 * 60, classic).map((r) => r.focusSeconds / 60)).toEqual([25, 28]);
  });

  it('follows the long plan', () => {
    const rounds = buildSchedule(150 * 60, POMODORO_PLANS.long);
    expect(rounds.map((r) => [r.focusSeconds / 60, r.breakSeconds / 60])).toEqual([
      [50, 10],
      [50, 20],
      [50, 0],
    ]);
  });
});

describe('advancePomodoro', () => {
  it('starts a break when a round ends, and focus stops counting', () => {
    const timer = session(60);
    expect(nextPomodoroEvent(timer)).toBe(25 * MIN);

    const { timer: onBreak, event } = advancePomodoro(timer, 26 * MIN);
    expect(event).toBe('break');
    expect(onBreak.pomodoro).toMatchObject({ phase: 'break', round: 1, breakEndsAt: 30 * MIN });
    // A minute late, but only the 25 minutes of the round count.
    expect(elapsedMs(onBreak, 29 * MIN)).toBe(25 * MIN);
    expect(pomodoroView(onBreak, 28 * MIN)?.clockMs).toBe(2 * MIN);
  });

  it('waits for you after the break instead of counting time away', () => {
    const onBreak = advancePomodoro(session(60), 25 * MIN).timer;
    const { timer: ready, event } = advancePomodoro(onBreak, 31 * MIN);
    expect(event).toBe('ready');
    expect(nextPomodoroEvent(ready)).toBe(Infinity);
    // Back 20 minutes later: still 25 minutes focused.
    expect(elapsedMs(ready, 50 * MIN)).toBe(25 * MIN);

    const next = startNextRound(ready, 50 * MIN);
    expect(next.pomodoro?.phase).toBe('focus');
    expect(elapsedMs(next, 60 * MIN)).toBe(35 * MIN);
    expect(nextPomodoroEvent(next)).toBe(75 * MIN);
  });

  it('skipping a break starts the next round straight away', () => {
    const onBreak = advancePomodoro(session(60), 25 * MIN).timer;
    const next = startNextRound(onBreak, 27 * MIN);
    expect(elapsedMs(next, 30 * MIN)).toBe(28 * MIN);
  });

  it('catches up correctly after the app was closed through a round and its break', () => {
    const { timer, event } = advancePomodoro(session(60), 3 * 60 * MIN);
    expect(event).toBe('ready');
    expect(elapsedMs(timer, 3 * 60 * MIN)).toBe(25 * MIN);
  });

  it('reports done at the end of the last round', () => {
    let timer = session(30);
    timer = startNextRound(advancePomodoro(timer, 25 * MIN).timer, 30 * MIN);
    expect(advancePomodoro(timer, 34 * MIN).event).toBeNull();
    expect(advancePomodoro(timer, 35 * MIN).event).toBe('done');
  });

  it('a manual pause in a round holds the round open', () => {
    const paused = pause(session(60), 10 * MIN);
    expect(advancePomodoro(paused, 60 * MIN).event).toBeNull();
    const resumed = resume(paused, 60 * MIN);
    expect(nextPomodoroEvent(resumed)).toBe(75 * MIN);
  });

  it('leaves a plain timer alone', () => {
    const plain = { ...session(60), pomodoro: null };
    expect(advancePomodoro(plain, 99 * MIN)).toEqual({ timer: plain, event: null });
  });
});
