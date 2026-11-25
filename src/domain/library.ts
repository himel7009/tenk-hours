import { daysBetween, type DayKey } from './dates';
import { describeDaysLeft, type DeadlineWords } from './deadline';
/** A book or course being worked through, tracked by how far along it is. */
export type LibraryItemId = string;
export type LibraryKind = 'book' | 'course';
export type LibraryUnit = 'chapter' | 'page' | 'lesson';
/** `planned` is saved for later: not started, kept so it isn't forgotten. */
export type LibraryStatus = 'planned' | 'active' | 'paused' | 'done';

export const LIBRARY_STATUSES: LibraryStatus[] = ['planned', 'active', 'paused', 'done'];

export interface LibraryItem {
  id: LibraryItemId;
  kind: LibraryKind;
  title: string;
  /** Author of a book, or the channel or teacher of a course. */
  author: string;
  /** Where to open it, such as a playlist. Empty or an http(s) URL. */
  url: string;
  /** What progress is counted in. */
  unit: LibraryUnit;
  /** How many units there are in all, if known. */
  totalUnits: number | null;
  /** Units finished so far. */
  doneUnits: number;
  /** Free-text bookmark, such as "Section 4.2" or "Video 12 at 34:10". */
  position: string;
  notes: string;
  status: LibraryStatus;
  /** The day to finish it by, if any. Missing or null is no deadline. */
  deadline?: DayKey | null;
  createdAt: number;
}

export const LIBRARY_LIMITS = {
  title: 120,
  author: 120,
  url: 500,
  position: 200,
  notes: 4000,
  units: 100_000,
} as const;

export const UNITS_FOR_KIND: Record<LibraryKind, LibraryUnit[]> = {
  book: ['chapter', 'page'],
  course: ['lesson'],
};

export const UNIT_LABELS: Record<LibraryUnit, { one: string; many: string }> = {
  chapter: { one: 'chapter', many: 'chapters' },
  page: { one: 'page', many: 'pages' },
  lesson: { one: 'lesson', many: 'lessons' },
};

/** True for the only kind of link the app will store or render. */
export function isWebUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** "Chapter 5 of 12", "Page 120", or "Not started". */
export function progressLabel(item: LibraryItem): string {
  const { one, many } = UNIT_LABELS[item.unit];
  if (item.status === 'done') return 'Finished';
  if (item.totalUnits !== null) {
    return `${item.doneUnits.toLocaleString()} of ${item.totalUnits.toLocaleString()} ${many}`;
  }
  if (item.doneUnits === 0) return 'Not started';
  return `${item.doneUnits.toLocaleString()} ${item.doneUnits === 1 ? one : many} done`;
}

/**
 * The lesson, chapter or page to start on next: "Lesson 8 of 23". Null once
 * the item is finished. Pages read "Page 121", since one page is not a unit
 * anyone starts on.
 */
export function nextUnitLabel(item: LibraryItem): string | null {
  if (item.status === 'done') return null;
  const next = item.doneUnits + 1;
  if (item.totalUnits !== null && next > item.totalUnits) return null;
  const name = item.unit.charAt(0).toUpperCase() + item.unit.slice(1);
  const of = item.totalUnits === null ? '' : ` of ${item.totalUnits.toLocaleString()}`;
  return `${name} ${next.toLocaleString()}${of}`;
}

/**
 * Moves progress by a number of units, staying within 0 and the total.
 * Reaching the total finishes the item; stepping back from it reopens it.
 * Making progress on something saved for later means it has been started.
 */
export function stepProgress(item: LibraryItem, by: number): LibraryItem {
  const max = item.totalUnits ?? LIBRARY_LIMITS.units;
  const doneUnits = Math.min(max, Math.max(0, item.doneUnits + by));
  const finished = item.totalUnits !== null && doneUnits >= item.totalUnits;
  const started = item.status === 'planned' && doneUnits > item.doneUnits;
  const status = finished ? 'done' : item.status === 'done' || started ? 'active' : item.status;
  return { ...item, doneUnits, status };
}

export interface LibraryProgress {
  /** Whole percent done. Shows 100 only once the item is finished. */
  percent: number;
  done: number;
  total: number;
  remaining: number;
}

/** How far along an item is, or null when its total is unknown. */
export function libraryProgress(item: LibraryItem): LibraryProgress | null {
  if (item.totalUnits === null || item.totalUnits <= 0) return null;
  const done = Math.min(item.doneUnits, item.totalUnits);
  const finished = item.status === 'done' || done >= item.totalUnits;
  // Floor, so 22 of 23 reads 95% and not a premature 100%.
  const percent = finished ? 100 : Math.floor((done / item.totalUnits) * 100);
  return { percent, done, total: item.totalUnits, remaining: item.totalUnits - done };
}

/** "16 lessons left", or null when the total is unknown or it is finished. */
export function remainingLabel(item: LibraryItem): string | null {
  const progress = libraryProgress(item);
  if (!progress || progress.remaining === 0 || item.status === 'done') return null;
  const { one, many } = UNIT_LABELS[item.unit];
  return `${progress.remaining.toLocaleString()} ${progress.remaining === 1 ? one : many} left`;
}

/** At or past this share, an item counts as almost finished. */
export const ALMOST_DONE_PERCENT = 75;

export interface LibrarySummary {
  /** Active items first, then paused, each furthest along first. */
  inProgress: { item: LibraryItem; progress: LibraryProgress | null }[];
  active: number;
  paused: number;
  planned: number;
  finished: number;
  /** Mean percent over in-progress items with a known total, or null. */
  averagePercent: number | null;
  almostDone: number;
}

export function summarizeLibrary(items: readonly LibraryItem[]): LibrarySummary {
  const count = (status: LibraryStatus) => items.filter((item) => item.status === status).length;
  const inProgress = items
    .filter((item) => item.status === 'active' || item.status === 'paused')
    .map((item) => ({ item, progress: libraryProgress(item) }))
    .sort(
      (a, b) =>
        Number(a.item.status === 'paused') - Number(b.item.status === 'paused') ||
        (b.progress?.percent ?? -1) - (a.progress?.percent ?? -1) ||
        a.item.title.localeCompare(b.item.title),
    );
  const known = inProgress.flatMap(({ progress }) => (progress ? [progress.percent] : []));
  return {
    inProgress,
    active: count('active'),
    paused: count('paused'),
    planned: count('planned'),
    finished: count('done'),
    averagePercent:
      known.length > 0 ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null,
    almostDone: known.filter((percent) => percent >= ALMOST_DONE_PERCENT).length,
  };
}

export interface LibraryDeadline extends DeadlineWords {
  daysLeft: number;
  /**
   * What finishing on time takes: "About 2 chapters a day", or null when the
   * total is unknown, the day has passed or nothing is left.
   */
  pace: string | null;
}

/** Where a book or course stands against its deadline, or null without one or once done. */
export function libraryDeadline(item: LibraryItem, today: DayKey): LibraryDeadline | null {
  if (!item.deadline || item.status === 'done') return null;
  const daysLeft = daysBetween(today, item.deadline);
  const words = describeDaysLeft(daysLeft, false)!;
  const progress = libraryProgress(item);
  let pace: string | null = null;
  if (progress && progress.remaining > 0 && daysLeft >= 0) {
    // Today counts as a day to work in.
    const perDay = progress.remaining / (daysLeft + 1);
    const { one, many } = UNIT_LABELS[item.unit];
    pace =
      perDay <= 1
        ? perDay >= 0.5
          ? `About 1 ${one} a day`
          : `About 1 ${one} every ${Math.round(1 / perDay)} days`
        : `About ${Math.ceil(perDay)} ${many} a day`;
  }
  return { ...words, daysLeft, pace };
}
