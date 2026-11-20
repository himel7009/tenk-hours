import type { Weekday } from '../domain/routine';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BadHabit, CheckIn } from '../domain/badHabits';
import type { Domain } from '../domain/domains';
import type { LibraryItem } from '../domain/library';
import type { Debt, DebtPayment } from '../domain/debts';
import type { MoneyEntry, MoneySection } from '../domain/money';
import type { Todo } from '../domain/todos';
import type { Session, Skill } from '../domain/types';
import { resetTrackerStore, useTrackerStore } from '../store/trackerStore';
import { syncOnce } from './syncEngine';
import type { PushBatch, RemoteChanges, RemoteStore, SyncCursors } from './types';

/** In-memory server with the same soft-delete and cursor behaviour. */
class FakeRemote implements RemoteStore {
  private clock = 0;
  skills = new Map<string, { row: Skill; deleted: boolean; at: number }>();
  sessions = new Map<string, { row: Session; deleted: boolean; at: number }>();
  library = new Map<string, { row: LibraryItem; deleted: boolean; at: number }>();
  domains = new Map<string, { row: Domain; deleted: boolean; at: number }>();
  badHabits = new Map<string, { row: BadHabit; deleted: boolean; at: number }>();
  checkIns = new Map<string, { row: CheckIn; deleted: boolean; at: number }>();
  todos = new Map<string, { row: Todo; deleted: boolean; at: number }>();
  moneySections = new Map<string, { row: MoneySection; deleted: boolean; at: number }>();
  moneyEntries = new Map<string, { row: MoneyEntry; deleted: boolean; at: number }>();
  debts = new Map<string, { row: Debt; deleted: boolean; at: number }>();
  debtPayments = new Map<string, { row: DebtPayment; deleted: boolean; at: number }>();
  failNextPush = false;

  async push(batch: PushBatch): Promise<void> {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('network down');
    }
    const at = ++this.clock;
    for (const row of batch.skillUpserts) this.skills.set(row.id, { row, deleted: false, at });
    for (const row of batch.sessionUpserts) this.sessions.set(row.id, { row, deleted: false, at });
    for (const id of batch.skillDeletes) this.softDelete(this.skills, id, at);
    for (const id of batch.sessionDeletes) this.softDelete(this.sessions, id, at);
    for (const row of batch.libraryUpserts) this.library.set(row.id, { row, deleted: false, at });
    for (const id of batch.libraryDeletes) this.softDelete(this.library, id, at);
    for (const row of batch.domainUpserts) this.domains.set(row.id, { row, deleted: false, at });
    for (const id of batch.domainDeletes) this.softDelete(this.domains, id, at);
    for (const row of batch.badHabitUpserts)
      this.badHabits.set(row.id, { row, deleted: false, at });
    for (const row of batch.checkInUpserts) this.checkIns.set(row.id, { row, deleted: false, at });
    for (const id of batch.checkInDeletes) this.softDelete(this.checkIns, id, at);
    for (const id of batch.badHabitDeletes) this.softDelete(this.badHabits, id, at);
    for (const row of batch.todoUpserts) this.todos.set(row.id, { row, deleted: false, at });
    for (const id of batch.todoDeletes) this.softDelete(this.todos, id, at);
    for (const row of batch.moneySectionUpserts) {
      this.moneySections.set(row.id, { row, deleted: false, at });
    }
    for (const row of batch.moneyEntryUpserts) {
      this.moneyEntries.set(row.id, { row, deleted: false, at });
    }
    for (const id of batch.moneyEntryDeletes) this.softDelete(this.moneyEntries, id, at);
    for (const id of batch.moneySectionDeletes) this.softDelete(this.moneySections, id, at);
    for (const row of batch.debtUpserts) this.debts.set(row.id, { row, deleted: false, at });
    for (const row of batch.debtPaymentUpserts) {
      this.debtPayments.set(row.id, { row, deleted: false, at });
    }
    for (const id of batch.debtPaymentDeletes) this.softDelete(this.debtPayments, id, at);
    for (const id of batch.debtDeletes) this.softDelete(this.debts, id, at);
  }

  async pull({
    cursor,
    libraryCursor,
    domainCursor,
    badHabitCursor,
    todoCursor,
    moneyCursor,
  }: SyncCursors): Promise<RemoteChanges> {
    const changed = <T>(
      rows: Map<string, { row: T; deleted: boolean; at: number }>,
      since: string | null,
    ) => [...rows.values()].filter((entry) => entry.at > Number(since ?? 0));
    const newest = (since: string | null, entries: { at: number }[]) =>
      entries.length === 0 ? since : String(Math.max(...entries.map((entry) => entry.at)));

    const skills = changed(this.skills, cursor);
    const sessions = changed(this.sessions, cursor);
    const library = changed(this.library, libraryCursor);
    const domains = changed(this.domains, domainCursor);
    const badHabits = changed(this.badHabits, badHabitCursor);
    const checkIns = changed(this.checkIns, badHabitCursor);
    const todos = changed(this.todos, todoCursor);
    const moneySections = changed(this.moneySections, moneyCursor);
    const moneyEntries = changed(this.moneyEntries, moneyCursor);
    const debts = changed(this.debts, moneyCursor);
    const debtPayments = changed(this.debtPayments, moneyCursor);
    return {
      skills,
      sessions,
      library,
      domains,
      badHabits,
      checkIns,
      todos,
      moneySections,
      moneyEntries,
      debts,
      debtPayments,
      cursors: {
        cursor: newest(cursor, [...skills, ...sessions]),
        libraryCursor: newest(libraryCursor, library),
        domainCursor: newest(domainCursor, domains),
        badHabitCursor: newest(badHabitCursor, [...badHabits, ...checkIns]),
        todoCursor: newest(todoCursor, todos),
        moneyCursor: newest(moneyCursor, [
          ...moneySections,
          ...moneyEntries,
          ...debts,
          ...debtPayments,
        ]),
      },
    };
  }

  private softDelete<T>(
    rows: Map<string, { row: T; deleted: boolean; at: number }>,
    id: string,
    at: number,
  ) {
    const entry = rows.get(id);
    if (entry) rows.set(id, { ...entry, deleted: true, at });
  }
}

/**
 * Simulates a second device by swapping the store's contents in and out.
 * Each device keeps its own state; they only share the remote.
 */
class Device {
  private saved = structuredClone(pick(useTrackerStore.getInitialState()));

  constructor(private userId = 'user-1') {}

  async use<T>(work: () => T | Promise<T>): Promise<T> {
    useTrackerStore.setState(this.saved);
    useTrackerStore.getState().adoptAccount(this.userId);
    try {
      return await work();
    } finally {
      this.saved = structuredClone(pick(useTrackerStore.getState()));
    }
  }
}

const pick = ({
  skills,
  sessions,
  library,
  domains,
  badHabits,
  checkIns,
  activeTimer,
  theme,
  sync,
}: ReturnType<typeof store>) => ({
  skills,
  sessions,
  library,
  domains,
  badHabits,
  checkIns,
  activeTimer,
  theme,
  sync,
});
const store = () => useTrackerStore.getState();
const sync = (remote: RemoteStore) => syncOnce(remote, useTrackerStore);
const skillInput = {
  name: 'Python',
  icon: '🐍',
  color: 'moss',
  targetHours: 10_000,
  dailyGoalMinutes: 60,
  keepStreak: true,
  routineDays: [] as Weekday[],
  domainId: null,
} as const;
const addSkill = (name = 'Python') =>
  store().addSkill('skill', {
    name,
    icon: '🐍',
    color: 'moss',
    targetHours: 10_000,
    dailyGoalMinutes: 60,
    keepStreak: true,
    routineDays: [] as Weekday[],
    domainId: null,
  });
const log = (skillId: string, minutes: number) =>
  store().logSession(skillId, { day: '2026-11-11', minutes, note: '' });

let remote: FakeRemote;
beforeEach(() => {
  resetTrackerStore();
  remote = new FakeRemote();
});

describe('signing in', () => {
  it('uploads data created as a guest', async () => {
    const skillId = addSkill();
    log(skillId, 60);

    store().adoptAccount('user-1');
    await sync(remote);

    expect(remote.skills.size).toBe(1);
    expect(remote.sessions.size).toBe(1);
    expect(store().sync.pendingSkills).toEqual({});
    expect(store().sync.pendingSessions).toEqual({});
  });

  it('drops data left on the device by a different account', async () => {
    store().adoptAccount('user-1');
    addSkill();

    store().adoptAccount('user-2');
    await sync(remote);

    expect(store().skills).toEqual([]);
    expect(remote.skills.size).toBe(0);
  });

  it('does not track pending changes for guests', () => {
    log(addSkill(), 30);
    expect(store().sync).toMatchObject({ rev: 0, pendingSkills: {}, pendingSessions: {} });
  });
});

describe('two devices', () => {
  it('bring each other up to date', async () => {
    const laptop = new Device();
    const phone = new Device();

    const skillId = await laptop.use(async () => {
      const id = addSkill();
      log(id, 45);
      await sync(remote);
      return id;
    });

    await phone.use(async () => {
      await sync(remote);
      expect(store().skills.map((s) => s.name)).toEqual(['Python']);
      expect(store().sessions).toHaveLength(1);
      log(skillId, 30);
      await sync(remote);
    });

    await laptop.use(async () => {
      await sync(remote);
      expect(
        store()
          .sessions.map((s) => s.minutes)
          .sort(),
      ).toEqual([30, 45]);
    });
  });

  it('propagate deletes, including the sessions of a deleted skill', async () => {
    const laptop = new Device();
    const phone = new Device();

    const skillId = await laptop.use(async () => {
      const id = addSkill();
      log(id, 45);
      await sync(remote);
      return id;
    });
    await phone.use(() => sync(remote));

    await laptop.use(async () => {
      store().deleteSkill(skillId);
      await sync(remote);
    });

    await phone.use(async () => {
      store().startTimer(skillId, null);
      await sync(remote);
      expect(store()).toMatchObject({ skills: [], sessions: [], activeTimer: null });
    });
  });

  it('resolve an edit conflict in favour of the device that synced last', async () => {
    const laptop = new Device();
    const phone = new Device();
    const skillId = await laptop.use(async () => {
      const id = addSkill();
      await sync(remote);
      return id;
    });
    await phone.use(() => sync(remote));

    const rename = (name: string) => store().updateSkill(skillId, { ...skillInput, name });
    await laptop.use(async () => {
      rename('Python (laptop)');
      await sync(remote);
    });
    await phone.use(async () => {
      rename('Python (phone)');
      await sync(remote);
    });
    await laptop.use(async () => {
      await sync(remote);
      expect(store().skills[0]?.name).toBe('Python (phone)');
    });
  });
});

describe('failures and races', () => {
  it('keeps changes pending when a push fails, then sends them next time', async () => {
    store().adoptAccount('user-1');
    addSkill();
    remote.failNextPush = true;

    await expect(sync(remote)).rejects.toThrow('network down');
    expect(Object.keys(store().sync.pendingSkills)).toHaveLength(1);

    await sync(remote);
    expect(remote.skills.size).toBe(1);
    expect(store().sync.pendingSkills).toEqual({});
  });

  it('keeps an edit made while its previous version was being pushed', async () => {
    store().adoptAccount('user-1');
    const skillId = addSkill();

    const slowRemote: RemoteStore = {
      pull: (cursors) => remote.pull(cursors),
      push: async (batch) => {
        await remote.push(batch);
        // The user renames the skill while the request is in flight.
        store().updateSkill(skillId, { ...skillInput, name: 'Renamed' });
      },
    };
    await syncOnce(slowRemote, useTrackerStore);

    expect(store().skills[0]?.name).toBe('Renamed');
    expect(store().sync.pendingSkills[skillId]?.op).toBe('upsert');

    await sync(remote);
    expect(remote.skills.get(skillId)?.row.name).toBe('Renamed');
  });

  it('restoring a backup replaces what is in the account', async () => {
    store().adoptAccount('user-1');
    const oldId = addSkill('Old');
    await sync(remote);

    store().replaceData({
      skills: [{ ...skillInput, id: 'new', kind: 'habit', name: 'New', createdAt: 1 }],
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
    });
    await sync(remote);

    expect(remote.skills.get(oldId)?.deleted).toBe(true);
    expect(remote.skills.get('new')?.deleted).toBe(false);
  });
});

describe('library', () => {
  const book = {
    kind: 'book',
    title: 'Deep Learning',
    author: '',
    url: '',
    unit: 'chapter',
    totalUnits: 20,
    doneUnits: 4,
    position: 'Section 5.2',
    notes: '',
    status: 'active',
  } as const;

  it('syncs books and courses between devices, including edits and deletes', async () => {
    const laptop = new Device();
    const phone = new Device();

    await laptop.use(async () => {
      store().addLibraryItem(book);
      await sync(remote);
    });

    const id = await phone.use(async () => {
      await sync(remote);
      const [item] = store().library;
      expect(item).toMatchObject({ title: 'Deep Learning', doneUnits: 4 });
      store().updateLibraryItem(item!.id, { ...book, doneUnits: 5, position: 'Section 6.1' });
      await sync(remote);
      return item!.id;
    });

    await laptop.use(async () => {
      await sync(remote);
      expect(store().library[0]).toMatchObject({ doneUnits: 5, position: 'Section 6.1' });
      store().deleteLibraryItem(id);
      await sync(remote);
    });

    await phone.use(async () => {
      await sync(remote);
      expect(store().library).toEqual([]);
    });
  });

  it('uploads a guest library on sign-in', async () => {
    store().addLibraryItem(book);
    store().adoptAccount('user-1');
    await sync(remote);
    expect(remote.library.size).toBe(1);
  });

  it('pulls the whole library on a device whose other data was already synced', async () => {
    // Another device added a book before this one learned about the library.
    await new Device().use(async () => {
      addSkill();
      store().addLibraryItem(book);
      await sync(remote);
    });

    store().adoptAccount('user-1');
    useTrackerStore.setState((state) => ({
      sync: {
        ...state.sync,
        cursor: '999',
        libraryCursor: null,
        domainCursor: null,
        badHabitCursor: null,
        todoCursor: null,
        moneyCursor: null,
      },
    }));
    await sync(remote);

    expect(store().library).toHaveLength(1);
  });
});

describe('domains', () => {
  const ai = { name: 'AI', icon: '🤖', color: 'cobalt' } as const;

  it('syncs a domain and the skills grouped under it', async () => {
    const laptop = new Device();
    const phone = new Device();

    await laptop.use(async () => {
      const domainId = store().addDomain(ai);
      store().addSkill('skill', { ...skillInput, name: 'Machine learning', domainId });
      await sync(remote);
    });

    await phone.use(async () => {
      await sync(remote);
      const [domain] = store().domains;
      expect(domain?.name).toBe('AI');
      expect(store().skills[0]?.domainId).toBe(domain?.id);
    });
  });

  it('deleting a domain keeps its skills and makes them standalone everywhere', async () => {
    const laptop = new Device();
    const phone = new Device();

    await laptop.use(async () => {
      const domainId = store().addDomain(ai);
      store().addSkill('skill', { ...skillInput, domainId });
      await sync(remote);
    });
    await phone.use(() => sync(remote));

    await laptop.use(async () => {
      store().deleteDomain(store().domains[0]!.id);
      expect(store().skills[0]?.domainId).toBeNull();
      await sync(remote);
    });

    await phone.use(async () => {
      await sync(remote);
      expect(store().domains).toEqual([]);
      expect(store().skills).toHaveLength(1);
      expect(store().skills[0]?.domainId).toBeNull();
    });
  });
});

describe('bad habits', () => {
  const doomscrolling = { name: 'Doomscrolling', icon: '📱', color: 'rose' } as const;

  it('syncs bad habits and their answers, and the later answer for a day wins', async () => {
    const laptop = new Device();
    const phone = new Device();

    const habitId = await laptop.use(async () => {
      const id = store().addBadHabit(doomscrolling);
      store().setCheckIn(id, '2026-11-17', 'clean');
      await sync(remote);
      return id;
    });

    await phone.use(async () => {
      await sync(remote);
      expect(store().badHabits.map((h) => h.name)).toEqual(['Doomscrolling']);
      expect(store().checkIns).toMatchObject([{ day: '2026-11-17', status: 'clean' }]);
      // Both devices answer for today before either has synced.
      store().setCheckIn(habitId, '2026-11-18', 'clean');
    });
    await laptop.use(() => store().setCheckIn(habitId, '2026-11-18', 'slipped'));

    await phone.use(() => sync(remote));
    await laptop.use(() => sync(remote));
    await phone.use(async () => {
      await sync(remote);
      // One row per day: the laptop answered last, so its answer stands.
      const today = store().checkIns.filter((c) => c.day === '2026-11-18');
      expect(today).toMatchObject([{ status: 'slipped' }]);
    });
  });

  it('clearing an answer and deleting a habit reach other devices', async () => {
    const laptop = new Device();
    const phone = new Device();

    const habitId = await laptop.use(async () => {
      const id = store().addBadHabit(doomscrolling);
      store().setCheckIn(id, '2026-11-17', 'clean');
      store().setCheckIn(id, '2026-11-18', 'clean');
      await sync(remote);
      return id;
    });
    await phone.use(() => sync(remote));

    await laptop.use(async () => {
      store().setCheckIn(habitId, '2026-11-18', null);
      await sync(remote);
    });
    await phone.use(async () => {
      await sync(remote);
      expect(store().checkIns.map((c) => c.day)).toEqual(['2026-11-17']);
    });

    await laptop.use(async () => {
      store().deleteBadHabit(habitId);
      await sync(remote);
    });
    await phone.use(async () => {
      await sync(remote);
      expect(store()).toMatchObject({ badHabits: [], checkIns: [] });
    });
  });

  it('syncs to-dos with their place and day, ticked off and deleted', async () => {
    store().adoptAccount('user-1');
    store().addTodo('Solve 5 loop problems', { domainId: 'ps', skillId: null, day: '2026-11-16' });
    store().addTodo('Email supervisor', { domainId: null, skillId: null, day: '2026-11-16' });
    await sync(remote);
    expect(remote.todos.size).toBe(2);

    const loops = store().todos.find((todo) => todo.title === 'Solve 5 loop problems')!;
    expect(remote.todos.get(loops.id)?.row).toMatchObject({ domainId: 'ps', day: '2026-11-16' });
    store().toggleTodo(loops.id);
    store().updateTodo(loops.id, { title: 'Solve 6 loop problems' });
    await sync(remote);
    expect(remote.todos.get(loops.id)?.row).toMatchObject({
      done: true,
      title: 'Solve 6 loop problems',
    });

    store().deleteTodo(loops.id);
    await sync(remote);
    expect(remote.todos.get(loops.id)?.deleted).toBe(true);
    expect(store().todos.map((todo) => todo.title)).toEqual(['Email supervisor']);
  });

  it('syncs money sections and entries, and deleting a section takes its entries', async () => {
    store().adoptAccount('user-1');
    const meal = store().addMoneySection({
      name: 'Meal',
      icon: '🍚',
      color: 'moss',
      carryOver: false,
    });
    const fund = store().addMoneySection({
      name: 'Fund',
      icon: '🏦',
      color: 'cobalt',
      carryOver: true,
    });
    store().addMoneyEntry({
      sectionId: meal,
      kind: 'spend',
      toSectionId: null,
      day: '2026-11-17',
      amount: 93800,
      note: 'Gulsha mach',
    });
    store().addMoneyEntry({
      sectionId: fund,
      kind: 'move',
      toSectionId: meal,
      day: '2026-11-16',
      amount: 100000,
      note: 'For meal',
    });
    await sync(remote);
    expect(remote.moneySections.size).toBe(2);
    expect(remote.moneyEntries.size).toBe(2);

    store().deleteMoneySection(meal);
    await sync(remote);
    expect(remote.moneySections.get(meal)?.deleted).toBe(true);
    // The expense and the move into Meal both go with it.
    expect([...remote.moneyEntries.values()].every((entry) => entry.deleted)).toBe(true);
    expect(store().moneyEntries).toEqual([]);
  });

  it('syncs debts and payments, and deleting a debt takes its payments', async () => {
    store().adoptAccount('user-1');
    const id = store().addDebt({
      direction: 'borrowed',
      person: 'Rahim',
      amount: 100000,
      day: '2026-11-10',
      dueDay: '2026-11-30',
      sectionId: null,
      note: '',
    });
    store().addDebtPayment({
      debtId: id,
      day: '2026-11-15',
      amount: 50000,
      sectionId: null,
      note: '',
    });
    await sync(remote);
    expect(remote.debts.get(id)?.row).toMatchObject({ person: 'Rahim', dueDay: '2026-11-30' });
    expect(remote.debtPayments.size).toBe(1);

    store().deleteDebt(id);
    await sync(remote);
    expect(remote.debts.get(id)?.deleted).toBe(true);
    expect([...remote.debtPayments.values()].every((p) => p.deleted)).toBe(true);
  });
});
