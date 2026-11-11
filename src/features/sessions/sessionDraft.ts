import type { DayKey } from '../../domain/dates';
import type { Session } from '../../domain/types';
import type { SessionInput } from '../../store/trackerStore';

const MAX_MINUTES_PER_SESSION = 24 * 60;

/** Form state for a session. Numbers stay as strings while being typed. */
export interface SessionDraft {
  hours: string;
  minutes: string;
  day: DayKey;
  note: string;
}

export function emptyDraft(day: DayKey): SessionDraft {
  return { hours: '', minutes: '', day, note: '' };
}

export function draftFromSession(session: Session): SessionDraft {
  return {
    hours: String(Math.floor(session.minutes / 60)),
    minutes: String(session.minutes % 60),
    day: session.day,
    note: session.note,
  };
}

export type DraftResult = { ok: true; input: SessionInput } | { ok: false; error: string };

export function validateDraft(draft: SessionDraft, today: DayKey): DraftResult {
  const hours = draft.hours === '' ? 0 : Number(draft.hours);
  const minutes = draft.minutes === '' ? 0 : Number(draft.minutes);

  if (![hours, minutes].every((n) => Number.isInteger(n) && n >= 0)) {
    return { ok: false, error: 'Enter whole numbers for hours and minutes.' };
  }
  const total = hours * 60 + minutes;
  if (total === 0) return { ok: false, error: 'Enter how long you practised.' };
  if (total > MAX_MINUTES_PER_SESSION) {
    return { ok: false, error: 'A single session can be at most 24 hours.' };
  }
  if (draft.day === '') return { ok: false, error: 'Choose a date.' };
  if (draft.day > today) return { ok: false, error: 'The date cannot be in the future.' };

  return { ok: true, input: { day: draft.day, minutes: total, note: draft.note.trim() } };
}
