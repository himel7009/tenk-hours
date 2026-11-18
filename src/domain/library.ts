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

/** Progress from 0 to 1, or null when the total is unknown. */
export function progressFraction(item: LibraryItem): number | null {
  if (item.totalUnits === null) return null;
  return Math.min(1, item.doneUnits / item.totalUnits);
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
