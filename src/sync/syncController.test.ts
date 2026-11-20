import { describe, expect, it, vi } from 'vitest';
import { resetTrackerStore, useTrackerStore } from '../store/trackerStore';
import { createSyncController } from './syncController';
import type { RemoteChanges, RemoteStore } from './types';

const EMPTY: RemoteChanges = {
  skills: [],
  sessions: [],
  library: [],
  domains: [],
  badHabits: [],
  checkIns: [],
  todos: [],
  moneySections: [],
  moneyEntries: [],
  cursors: {
    cursor: null,
    libraryCursor: null,
    domainCursor: null,
    badHabitCursor: null,
    todoCursor: null,
    moneyCursor: null,
  },
};

function slowRemote() {
  const releases: (() => void)[] = [];
  const remote: RemoteStore = {
    push: async () => {},
    pull: vi.fn<RemoteStore['pull']>(
      () =>
        new Promise<RemoteChanges>((resolve) => {
          releases.push(() => resolve(EMPTY));
        }),
    ),
  };
  return { remote, releases };
}

describe('sync controller', () => {
  it('coalesces requests made while a sync is running into one follow-up', async () => {
    resetTrackerStore();
    const { remote, releases } = slowRemote();
    const phases: string[] = [];
    const controller = createSyncController(remote, useTrackerStore, (p) => phases.push(p));

    controller.request();
    controller.request();
    controller.request();
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    releases[0]!();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases[1]!();
    await controller.settle();

    expect(remote.pull).toHaveBeenCalledTimes(2);
    expect(phases.at(-1)).toBe('idle');
  });

  it('reports an error and recovers on the next request', async () => {
    resetTrackerStore();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pull = vi
      .fn<RemoteStore['pull']>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(EMPTY);
    const phases: string[] = [];
    const controller = createSyncController({ push: async () => {}, pull }, useTrackerStore, (p) =>
      phases.push(p),
    );

    controller.request();
    await controller.settle();
    expect(phases.at(-1)).toBe('error');

    controller.request();
    await controller.settle();
    expect(phases.at(-1)).toBe('idle');
  });
});
