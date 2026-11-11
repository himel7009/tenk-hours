import { describe, expect, it } from 'vitest';
import type { Session, Skill } from '../domain/types';
import { BackupError, createBackup, parseBackup } from './backup';

const skill: Skill = { id: 's1', name: 'Python', color: 'moss', targetHours: 10_000, createdAt: 1 };
const session: Session = {
  id: 'a',
  skillId: 's1',
  day: '2026-03-10',
  minutes: 90,
  note: 'decorators',
  source: 'timer',
  createdAt: 2,
};

describe('backup', () => {
  it('round-trips skills and sessions', () => {
    const json = JSON.stringify(createBackup([skill], [session]));
    expect(parseBackup(json)).toEqual({ skills: [skill], sessions: [session] });
  });

  it('drops sessions whose skill is missing', () => {
    const json = JSON.stringify(createBackup([skill], [{ ...session, skillId: 'gone' }]));
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
