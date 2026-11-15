import { describe, expect, it } from 'vitest';
import type { LibraryItem } from '../domain/library';
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

const item: LibraryItem = {
  id: '9b2c1f6e-1d3a-4f5b-8c7d-2e4f6a8b0c1d',
  kind: 'course',
  title: 'Neural Networks: Zero to Hero',
  author: 'Andrej Karpathy',
  url: 'https://www.youtube.com/playlist?list=example',
  unit: 'lesson',
  totalUnits: 8,
  doneUnits: 3,
  position: 'Video 4 at 12:30',
  notes: 'Redo the backprop exercise',
  status: 'active',
  createdAt: 3,
};

describe('backup', () => {
  it('drops a link that is not a web address', () => {
    const json = JSON.stringify(
      createBackup({
        skills: [],
        sessions: [],
        library: [{ ...item, url: 'javascript:alert(1)' }],
      }),
    );
    expect(parseBackup(json).library[0]?.url).toBe('');
  });

  it('fills in defaults for backups made before habits existed', () => {
    const oldSkill = { id: SKILL_ID, name: 'Python', color: 'moss', targetHours: 10_000 };
    const json = JSON.stringify({
      ...createBackup({ skills: [], sessions: [], library: [] }),
      version: 1,
      skills: [oldSkill],
    });
    expect(parseBackup(json).skills[0]).toMatchObject({
      kind: 'skill',
      icon: '🎯',
      dailyGoalMinutes: 60,
    });
  });

  it('round-trips skills and sessions', () => {
    const json = JSON.stringify(
      createBackup({ skills: [skill], sessions: [session], library: [item] }),
    );
    expect(parseBackup(json)).toEqual({ skills: [skill], sessions: [session], library: [item] });
  });

  it('drops sessions whose skill is missing', () => {
    const json = JSON.stringify(
      createBackup({
        skills: [skill],
        sessions: [{ ...session, skillId: '00000000-0000-4000-8000-000000000000' }],
        library: [],
      }),
    );
    expect(parseBackup(json).sessions).toEqual([]);
  });

  it.each([
    ['not json', 'not valid JSON'],
    [JSON.stringify({ app: 'other' }), 'not a Tenk backup'],
    [JSON.stringify({ app: 'tenk', version: 99, skills: [], sessions: [] }), 'newer version'],
    [
      JSON.stringify({
        ...createBackup({
          skills: [skill],
          sessions: [{ ...session, day: '2026-02-31' }],
          library: [],
        }),
      }),
      'session that cannot be read',
    ],
  ])('rejects bad input: %#', (json, message) => {
    expect(() => parseBackup(json)).toThrow(BackupError);
    expect(() => parseBackup(json)).toThrow(message);
  });
});
