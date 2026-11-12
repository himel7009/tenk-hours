import { describe, expect, it } from 'vitest';
import type { Session, Skill } from '../domain/types';
import { BackupError, createBackup, parseBackup } from './backup';

const SKILL_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const skill: Skill = {
  id: SKILL_ID,
  kind: 'skill',
  name: 'Python',
  icon: '🐍',
  color: 'moss',
  targetHours: 10_000,
  dailyGoalMinutes: 60,
  createdAt: 1,
};
const session: Session = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  skillId: SKILL_ID,
  day: '2026-03-10',
  minutes: 90,
  note: 'decorators',
  source: 'timer',
  createdAt: 2,
};

describe('backup', () => {
  it('fills in defaults for backups made before habits existed', () => {
    const oldSkill = { id: SKILL_ID, name: 'Python', color: 'moss', targetHours: 10_000 };
    const json = JSON.stringify({ ...createBackup([], []), version: 1, skills: [oldSkill] });
    expect(parseBackup(json).skills[0]).toMatchObject({
      kind: 'skill',
      icon: '🎯',
      dailyGoalMinutes: 60,
    });
  });

  it('round-trips skills and sessions', () => {
    const json = JSON.stringify(createBackup([skill], [session]));
    expect(parseBackup(json)).toEqual({ skills: [skill], sessions: [session] });
  });

  it('drops sessions whose skill is missing', () => {
    const json = JSON.stringify(
      createBackup([skill], [{ ...session, skillId: '00000000-0000-4000-8000-000000000000' }]),
    );
    expect(parseBackup(json).sessions).toEqual([]);
  });

  it.each([
    ['not json', 'not valid JSON'],
    [JSON.stringify({ app: 'other' }), 'not a Tenk backup'],
    [JSON.stringify({ app: 'tenk', version: 99, skills: [], sessions: [] }), 'newer version'],
    [
      JSON.stringify({ ...createBackup([skill], [{ ...session, day: '2026-02-31' }]) }),
      'session that cannot be read',
    ],
  ])('rejects bad input: %#', (json, message) => {
    expect(() => parseBackup(json)).toThrow(BackupError);
    expect(() => parseBackup(json)).toThrow(message);
  });
});
