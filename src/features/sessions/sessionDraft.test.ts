import { describe, expect, it } from 'vitest';
import { emptyDraft, validateDraft } from './sessionDraft';

const today = '2026-03-10';
const draft = (overrides: Partial<ReturnType<typeof emptyDraft>>) => ({
  ...emptyDraft(today),
  ...overrides,
});

describe('validateDraft', () => {
  it('combines hours and minutes', () => {
    expect(validateDraft(draft({ hours: '1', minutes: '30', note: ' loops ' }), today)).toEqual({
      ok: true,
      input: { day: today, minutes: 90, note: 'loops' },
    });
  });

  it('accepts minutes alone', () => {
    expect(validateDraft(draft({ minutes: '25' }), today)).toMatchObject({ ok: true });
  });

  it.each([
    [{}, 'how long'],
    [{ hours: '1.5' }, 'whole numbers'],
    [{ hours: '25' }, 'at most 24 hours'],
    [{ hours: '1', day: '2026-03-11' }, 'future'],
  ])('rejects %j', (overrides, message) => {
    const result = validateDraft(draft(overrides), today);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining(message) });
  });
});
