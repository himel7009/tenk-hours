import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTrackerStore, useTrackerStore } from './trackerStore';

const store = () => useTrackerStore.getState();
const newSkill = () =>
  store().addSkill('skill', {
    name: 'Drawing',
    icon: '🎨',
    color: 'plum',
    targetHours: 10_000,
    dailyGoalMinutes: 60,
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 2, 10, 9, 0));
  resetTrackerStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sessions', () => {
  it('logs, edits and deletes a session', () => {
    const skillId = newSkill();
    store().logSession(skillId, { day: '2026-03-10', minutes: 45, note: '' });
    const [session] = store().sessions;
    expect(session).toMatchObject({ skillId, minutes: 45, source: 'manual' });

    store().updateSession(session!.id, { day: '2026-03-09', minutes: 30, note: 'gesture' });
    expect(store().sessions[0]).toMatchObject({ day: '2026-03-09', minutes: 30, note: 'gesture' });

    store().deleteSession(session!.id);
    expect(store().sessions).toEqual([]);
  });

  it('deleting a skill removes its sessions and running timer', () => {
    const skillId = newSkill();
    store().logSession(skillId, { day: '2026-03-10', minutes: 45, note: '' });
    store().startTimer(skillId, null);

    store().deleteSkill(skillId);

    expect(store()).toMatchObject({ skills: [], sessions: [], activeTimer: null });
  });
});

describe('timer', () => {
  it('saves the elapsed time as a session on the day it started', () => {
    const skillId = newSkill();
    vi.setSystemTime(new Date(2026, 2, 10, 23, 30));
    store().startTimer(skillId, null);
    vi.setSystemTime(new Date(2026, 2, 11, 0, 45));

    const saved = store().stopTimer();

    expect(saved).toMatchObject({ day: '2026-03-10', minutes: 75, source: 'timer' });
    expect(store().activeTimer).toBeNull();
    expect(store().sessions).toHaveLength(1);
  });

  it('saves a countdown as its planned length, however late it is stopped', () => {
    store().startTimer(newSkill(), 120);
    // The tab was closed and reopened five hours later.
    vi.advanceTimersByTime(5 * 60 * 60_000);

    expect(store().stopTimer()).toMatchObject({ minutes: 120, day: '2026-03-10' });
  });

  it('saves only the time spent when a countdown is stopped early', () => {
    store().startTimer(newSkill(), 120);
    vi.advanceTimersByTime(45 * 60_000);

    expect(store().stopTimer()).toMatchObject({ minutes: 45 });
  });

  it('does not save a run shorter than a minute', () => {
    store().startTimer(newSkill(), null);
    vi.advanceTimersByTime(20_000);

    expect(store().stopTimer()).toBeNull();
    expect(store().sessions).toEqual([]);
  });
});
