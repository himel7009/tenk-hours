import { describe, expect, it } from 'vitest';
import { checkInId, type BadHabit, type CheckIn } from '../domain/badHabits';
import type { Domain } from '../domain/domains';
import type { LibraryItem } from '../domain/library';
import type { Session, Skill } from '../domain/types';
import { BackupError, createBackup, parseBackup } from './backup';

const DOMAIN_ID = '5a1f0c2e-7b3d-4e6f-9a8b-1c2d3e4f5a6b';
const SKILL_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const skill: Skill = {
  id: SKILL_ID,
  kind: 'skill',
  name: 'Python',
  icon: '🐍',
  color: 'moss',
  targetHours: 10_000,
  dailyGoalMinutes: 60,
  keepStreak: true,
  routineDays: [],
  addedDays: ['2026-11-23'],
  skippedDays: [],
  domainId: DOMAIN_ID,
  createdAt: 1,
};
const domain: Domain = {
  id: DOMAIN_ID,
  name: 'AI',
  icon: '🤖',
  color: 'cobalt',
  routineDays: [],
  addedDays: [],
  skippedDays: [],
  createdAt: 0,
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

const HABIT_ID = '7d3e1a2b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
const habit: BadHabit = {
  id: HABIT_ID,
  name: 'Doomscrolling',
  icon: '📱',
  color: 'rose',
  createdAt: 4,
};
const checkIn: CheckIn = {
  id: checkInId(HABIT_ID, '2026-11-18'),
  habitId: HABIT_ID,
  day: '2026-11-18',
  status: 'clean',
  createdAt: 5,
};

describe('backup', () => {
  it('drops check-ins whose bad habit is not in the backup', () => {
    const json = JSON.stringify(
      createBackup({
        skills: [],
        sessions: [],
        library: [],
        domains: [],
        badHabits: [],
        checkIns: [checkIn],
        todos: [],
        moneySections: [],
        moneyEntries: [],
        debts: [],
        debtPayments: [],
      }),
    );
    expect(parseBackup(json).checkIns).toEqual([]);
  });

  it('makes a skill standalone when its domain is not in the backup', () => {
    const json = JSON.stringify(
      createBackup({
        skills: [skill],
        sessions: [],
        library: [],
        domains: [],
        badHabits: [],
        checkIns: [],
        todos: [],
        moneySections: [],
        moneyEntries: [],
        debts: [],
        debtPayments: [],
      }),
    );
    expect(parseBackup(json).skills[0]?.domainId).toBeNull();
  });

  it('drops a link that is not a web address', () => {
    const json = JSON.stringify(
      createBackup({
        skills: [],
        sessions: [],
        library: [{ ...item, url: 'javascript:alert(1)' }],
        domains: [],
        badHabits: [],
        checkIns: [],
        todos: [],
        moneySections: [],
        moneyEntries: [],
        debts: [],
        debtPayments: [],
      }),
    );
    expect(parseBackup(json).library[0]?.url).toBe('');
  });

  it('keeps custom colours and replaces anything that is not a colour', () => {
    const skill = (id: string, color: string) => ({
      id,
      name: 'Python',
      color,
      targetHours: 10_000,
    });
    const json = JSON.stringify({
      ...createBackup({
        skills: [],
        sessions: [],
        library: [],
        domains: [],
        badHabits: [],
        checkIns: [],
        todos: [],
        moneySections: [],
        moneyEntries: [],
        debts: [],
        debtPayments: [],
      }),
      skills: [
        skill('00000000-0000-4000-8000-0000000000a1', '#1f8a70'),
        skill('00000000-0000-4000-8000-0000000000a2', 'gold'),
        skill('00000000-0000-4000-8000-0000000000a3', "red'] body {"),
      ],
    });
    expect(parseBackup(json).skills.map((s) => s.color)).toEqual(['#1f8a70', 'gold', 'cobalt']);
  });

  it('fills in defaults for backups made before habits existed', () => {
    const oldSkill = { id: SKILL_ID, name: 'Python', color: 'moss', targetHours: 10_000 };
    const json = JSON.stringify({
      ...createBackup({
        skills: [],
        sessions: [],
        library: [],
        domains: [],
        badHabits: [],
        checkIns: [],
        todos: [],
        moneySections: [],
        moneyEntries: [],
        debts: [],
        debtPayments: [],
      }),
      version: 1,
      skills: [oldSkill],
    });
    expect(parseBackup(json).skills[0]).toMatchObject({
      kind: 'skill',
      icon: '🎯',
      dailyGoalMinutes: 60,
      keepStreak: true,
      routineDays: [],
    });
  });

  it('round-trips skills and sessions', () => {
    const json = JSON.stringify(
      createBackup({
        skills: [skill],
        sessions: [session],
        library: [item],
        domains: [domain],
        badHabits: [habit],
        checkIns: [checkIn],
        todos: [],
        moneySections: [],
        moneyEntries: [],
        debts: [],
        debtPayments: [],
      }),
    );
    expect(parseBackup(json)).toEqual({
      skills: [skill],
      sessions: [session],
      library: [item],
      domains: [domain],
      badHabits: [habit],
      checkIns: [checkIn],
      todos: [],
      moneySections: [],
      moneyEntries: [],
      debts: [],
      debtPayments: [],
    });
  });

  it('drops sessions whose skill is missing', () => {
    const json = JSON.stringify(
      createBackup({
        skills: [skill],
        sessions: [{ ...session, skillId: '00000000-0000-4000-8000-000000000000' }],
        library: [],
        domains: [],
        badHabits: [],
        checkIns: [],
        todos: [],
        moneySections: [],
        moneyEntries: [],
        debts: [],
        debtPayments: [],
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
          domains: [],
          badHabits: [],
          checkIns: [],
          todos: [],
          moneySections: [],
          moneyEntries: [],
          debts: [],
          debtPayments: [],
        }),
      }),
      'session that cannot be read',
    ],
  ])('rejects bad input: %#', (json, message) => {
    expect(() => parseBackup(json)).toThrow(BackupError);
    expect(() => parseBackup(json)).toThrow(message);
  });
});
