import { describe, expect, it } from 'vitest';
import { clockMs, elapsedMs, pause, remainingMs, resume, timerEndsAt } from './timer';
import type { ActiveTimer } from './types';

const MIN = 60_000;
const countdown = (seconds: number): ActiveTimer => ({
  skillId: 's',
  startedAt: 0,
  durationSeconds: seconds,
  pausedAt: null,
  pausedMs: 0,
});
const stopwatch: ActiveTimer = { ...countdown(0), durationSeconds: null };

describe('timer', () => {
  it('counts down and stops at zero', () => {
    const timer = countdown(25 * 60);
    expect(clockMs(timer, 10 * MIN)).toBe(15 * MIN);
    expect(remainingMs(timer, 40 * MIN)).toBe(0);
    expect(elapsedMs(timer, 40 * MIN)).toBe(25 * MIN);
    expect(timerEndsAt(timer)).toBe(25 * MIN);
  });

  it('freezes while paused and leaves out the paused time', () => {
    let timer = pause(countdown(30 * 60), 10 * MIN);
    // Ten minutes go by while paused: nothing changes.
    expect(clockMs(timer, 20 * MIN)).toBe(20 * MIN);
    expect(timerEndsAt(timer)).toBe(Infinity);

    timer = resume(timer, 20 * MIN);
    expect(elapsedMs(timer, 25 * MIN)).toBe(15 * MIN);
    // The end moves back by the length of the pause.
    expect(timerEndsAt(timer)).toBe(40 * MIN);
  });

  it('adds up several pauses', () => {
    let timer = stopwatch;
    timer = resume(pause(timer, 5 * MIN), 7 * MIN);
    timer = resume(pause(timer, 10 * MIN), 13 * MIN);
    expect(elapsedMs(timer, 20 * MIN)).toBe(15 * MIN);
  });

  it('ignores pausing twice or resuming a running timer', () => {
    const paused = pause(stopwatch, 5 * MIN);
    expect(pause(paused, 9 * MIN)).toBe(paused);
    expect(resume(stopwatch, 9 * MIN)).toBe(stopwatch);
  });

  it('supports countdowns with seconds', () => {
    const timer = countdown(90 * 60 + 45);
    expect(remainingMs(timer, 90 * MIN)).toBe(45_000);
  });
});
