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
  keepStreak: true,
  routineDays: [],
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

  it("counts a project's time in the total but not towards the streak", () => {
    const app = { ...skill('app'), kind: 'project' as const, keepStreak: false };
    const summary = summarizeDomain([ml, app], [session('app', today, 300)], today);
    expect(summary.loggedMinutes).toBe(300);
    expect(summary.streak.current).toBe(0);
    expect(summary.activeDays.has(today)).toBe(true);
  });

  it('adds up the daily goals into a plan and measures today against it', () => {
    const nlp = skill('nlp', 30);
    const cv = skill('cv', 30);
    const app = { ...skill('app'), kind: 'project' as const, keepStreak: false };
    const { plan } = summarizeDomain(
      [ml, dl, nlp, cv, app],
      [session('ml', today, 150), session('nlp', today, 20), session('app', today, 300)],
      today,
    );
    // 1h + 1h + 30m + 30m; the project has no goal and is left out.
    expect(plan.totalMinutes).toBe(180);
    // Machine learning counts for its 60 goal minutes, not all 150.
    expect(plan.coveredMinutes).toBe(80);
    expect(plan.doneCount).toBe(1);
    expect(plan.items.map((item) => item.skill.id)).toEqual(['ml', 'dl', 'nlp', 'cv']);
  });

  it('keeps the past and the longest streak when a day is missed', () => {
    const summary = summarizeDomain(
      [ml],
      [
        session('ml', '2026-11-10', 60),
        session('ml', '2026-11-11', 60),
        session('ml', '2026-11-12', 60),
        // 13 and 14 missed
        session('ml', today, 60),
      ],
      today,
    );
    expect(summary.streak).toMatchObject({ current: 1, longest: 3 });
    expect(summary.loggedMinutes).toBe(240);
    expect(summary.activeDays.size).toBe(4);
  });

  it('ignores sessions of skills outside the domain', () => {
    const summary = summarizeDomain([ml], [session('swimming', today, 500)], today);
    expect(summary.loggedMinutes).toBe(0);
  });

  it('is empty for a domain with no skills', () => {
    expect(summarizeDomain([], [], today)).toMatchObject({ loggedMinutes: 0, shares: [] });
  });

  it('carries its streak over days off its routine, with no plan on those days', () => {
    // 2026-11-16 is a Monday. AI is studied on Sundays and Tuesdays.
    const ml = { ...skill('ml'), routineDays: [0, 2] as Skill['routineDays'] };
    const sessions = [session('ml', '2026-11-10', 60), session('ml', '2026-11-15', 60)];
    const summary = summarizeDomain([ml], sessions, today);
    expect(summary.plannedToday).toBe(false);
    expect(summary.plan.items).toEqual([]);
    expect(summary.streak.current).toBe(2);
  });

  it("is on when any skill is, and plans only today's skills", () => {
    // 2026-11-16 is a Monday: ML is on Mondays, DL on Tuesdays.
    const ml = { ...skill('ml'), routineDays: [1] as Skill['routineDays'] };
    const dl = { ...skill('dl'), routineDays: [2] as Skill['routineDays'] };
    const summary = summarizeDomain([ml, dl], [], today);
    expect(summary.plannedToday).toBe(true);
    expect(summary.plan.items.map((item) => item.skill.id)).toEqual(['ml']);
  });

  it('has no streak when none of its skills keeps one', () => {
    const relaxed = { ...skill('ml'), keepStreak: false };
    const summary = summarizeDomain([relaxed], [session('ml', today, 90)], today);
    expect(summary.keepsStreak).toBe(false);
    expect(summary.streak.current).toBe(0);
    // Its daily goal still makes up today's plan.
    expect(summary.plan.items).toHaveLength(1);
  });

  it('gives a project that keeps a streak a daily goal', () => {
    const app = { ...skill('app'), kind: 'project' as const, keepStreak: true };
    const summary = summarizeDomain([app], [session('app', today, 60)], today);
    expect(summary.streak.current).toBe(1);
    expect(summary.plan.items).toHaveLength(1);
  });
});
