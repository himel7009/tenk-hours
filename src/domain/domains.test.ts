import { describe, expect, it } from 'vitest';
import { summarizeDomain } from './domains';
import type { Session, Skill } from './types';

const skill = (id: string, dailyGoalMinutes = 60): Skill => ({
  id,
  kind: 'skill',
  name: id,
  icon: '🎯',
  color: 'cobalt',
  targetHours: 10_000,
  dailyGoalMinutes,
  domainId: 'ai',
  createdAt: 0,
});

const session = (skillId: string, day: string, minutes: number): Session => ({
  id: `${skillId}-${day}-${minutes}`,
  skillId,
  day,
  minutes,
  note: '',
  source: 'manual',
  createdAt: 0,
});

describe('summarizeDomain', () => {
  const today = '2026-11-16';
  const ml = skill('ml');
  const dl = skill('dl');

  it('adds up the time of every skill in the domain', () => {
    const summary = summarizeDomain(
      [ml, dl],
      [session('ml', today, 90), session('dl', today, 30), session('dl', '2026-11-10', 120)],
      today,
    );
    expect(summary.loggedMinutes).toBe(240);
    expect(summary.minutesToday).toBe(120);
    expect(summary.shares.map((share) => share.minutes)).toEqual([90, 150]);
  });

  it('keeps the streak going when any one skill reaches its goal each day', () => {
    const summary = summarizeDomain(
      [ml, dl],
      [session('ml', '2026-11-14', 60), session('dl', '2026-11-15', 75), session('ml', today, 60)],
      today,
    );
    expect(summary.streak.current).toBe(3);
  });

  it('does not count a day where time was split and no skill reached its goal', () => {
    const summary = summarizeDomain(
      [ml, dl],
      [session('ml', today, 40), session('dl', today, 40)],
      today,
    );
    expect(summary.streak.current).toBe(0);
    expect(summary.activeDays.has(today)).toBe(true);
  });

  it('ignores sessions of skills outside the domain', () => {
    const summary = summarizeDomain([ml], [session('swimming', today, 500)], today);
    expect(summary.loggedMinutes).toBe(0);
  });

  it('is empty for a domain with no skills', () => {
    expect(summarizeDomain([], [], today)).toMatchObject({ loggedMinutes: 0, shares: [] });
  });
});
