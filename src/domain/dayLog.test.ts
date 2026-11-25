import { describe, expect, it } from 'vitest';
import { buildDayLog } from './dayLog';
import type { Session, Skill } from './types';

const skill = (id: string, name: string): Skill =>
  ({ id, name, icon: '📘', color: 'cobalt', kind: 'skill' }) as Skill;

const session = (
  id: string,
  skillId: string,
  day: string,
  minutes: number,
  createdAt: number,
): Session => ({
  id,
  skillId,
  day,
  minutes,
  note: `note ${id}`,
  source: 'timer',
  createdAt,
});

describe('buildDayLog', () => {
  it("lists the day's sessions newest first with their skill, and adds them up", () => {
    const log = buildDayLog(
      [
        session('a', 'ml', '2026-11-25', 30, 1),
        session('b', 'dl', '2026-11-25', 45, 3),
        session('c', 'ml', '2026-11-24', 60, 2),
        session('d', 'gone', '2026-11-25', 15, 4),
      ],
      [skill('ml', 'Machine learning'), skill('dl', 'Deep learning')],
      '2026-11-25',
    );
    expect(log.entries.map((e) => [e.session.id, e.skill.name])).toEqual([
      ['b', 'Deep learning'],
      ['a', 'Machine learning'],
    ]);
    expect(log.totalMinutes).toBe(75);
  });

  it('is empty on a day with nothing', () => {
    expect(buildDayLog([], [], '2026-11-25')).toEqual({ entries: [], totalMinutes: 0 });
  });
});
