import { beforeEach, describe, expect, it } from 'vitest';
import type { Session, Skill } from '../domain/types';
import { resetTrackerStore, useTrackerStore } from '../store/trackerStore';
import { syncOnce } from './syncEngine';
import type { PushBatch, RemoteChanges, RemoteStore } from './types';

/** In-memory server with the same soft-delete and cursor behaviour. */
class FakeRemote implements RemoteStore {
  private clock = 0;
  skills = new Map<string, { row: Skill; deleted: boolean; at: number }>();
  sessions = new Map<string, { row: Session; deleted: boolean; at: number }>();
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
  }

  async pull(cursor: string | null): Promise<RemoteChanges> {
    const since = cursor === null ? 0 : Number(cursor);
    const changed = <T>(rows: Map<string, { row: T; deleted: boolean; at: number }>) =>
      [...rows.values()].filter((entry) => entry.at > since);
    const skills = changed(this.skills);
    const sessions = changed(this.sessions);
    const newest = Math.max(since, ...[...skills, ...sessions].map((entry) => entry.at));
    return { skills, sessions, cursor: newest > since ? String(newest) : null };
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

const pick = ({ skills, sessions, activeTimer, theme, sync }: ReturnType<typeof store>) => ({
  skills,
  sessions,
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
} as const;
const addSkill = (name = 'Python') =>
  store().addSkill('skill', {
    name,
    icon: '🐍',
    color: 'moss',
    targetHours: 10_000,
    dailyGoalMinutes: 60,
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
      pull: (cursor) => remote.pull(cursor),
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
    });
    await sync(remote);

    expect(remote.skills.get(oldId)?.deleted).toBe(true);
    expect(remote.skills.get('new')?.deleted).toBe(false);
  });
});
