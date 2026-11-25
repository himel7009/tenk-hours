import { describe, expect, it } from 'vitest';
import {
  libraryDeadline,
  isWebUrl,
  libraryProgress,
  nextUnitLabel,
  progressLabel,
  remainingLabel,
  stepProgress,
  summarizeLibrary,
  type LibraryItem,
} from './library';

const book: LibraryItem = {
  id: 'b',
  kind: 'book',
  title: 'Deep Learning',
  author: 'Goodfellow',
  url: '',
  unit: 'chapter',
  totalUnits: 20,
  doneUnits: 4,
  position: '',
  notes: '',
  status: 'active',
  createdAt: 0,
};

describe('stepProgress', () => {
  it('moves forward and back within bounds', () => {
    expect(stepProgress(book, 1).doneUnits).toBe(5);
    expect(stepProgress({ ...book, doneUnits: 0 }, -1).doneUnits).toBe(0);
    expect(stepProgress({ ...book, doneUnits: 20 }, 1).doneUnits).toBe(20);
  });

  it('finishes the item on the last unit and reopens it when stepping back', () => {
    const finished = stepProgress({ ...book, doneUnits: 19 }, 1);
    expect(finished.status).toBe('done');
    expect(stepProgress(finished, -1).status).toBe('active');
  });

  it('never finishes an item whose total is unknown', () => {
    expect(stepProgress({ ...book, totalUnits: null, doneUnits: 500 }, 1)).toMatchObject({
      doneUnits: 501,
      status: 'active',
    });
  });

  it('starts an item saved for later once progress is made on it', () => {
    const saved = { ...book, status: 'planned' as const, doneUnits: 0 };
    expect(stepProgress(saved, 1).status).toBe('active');
    expect(stepProgress(saved, -1).status).toBe('planned');
  });

  it('leaves a paused item paused', () => {
    expect(stepProgress({ ...book, status: 'paused' }, 1).status).toBe('paused');
  });
});

describe('progressLabel', () => {
  it('describes progress with and without a total', () => {
    expect(progressLabel(book)).toBe('4 of 20 chapters');
    expect(progressLabel({ ...book, totalUnits: null, unit: 'page', doneUnits: 1 })).toBe(
      '1 page done',
    );
    expect(progressLabel({ ...book, totalUnits: null, doneUnits: 0 })).toBe('Not started');
    expect(progressLabel({ ...book, status: 'done' })).toBe('Finished');
  });
});

describe('nextUnitLabel', () => {
  const course: LibraryItem = {
    ...book,
    kind: 'course',
    unit: 'lesson',
    totalUnits: 23,
    doneUnits: 7,
  };

  it('names the next lesson after the finished ones', () => {
    expect(nextUnitLabel(course)).toBe('Lesson 8 of 23');
    expect(nextUnitLabel({ ...course, doneUnits: 0 })).toBe('Lesson 1 of 23');
    expect(nextUnitLabel({ ...book, doneUnits: 4 })).toBe('Chapter 5 of 20');
    expect(nextUnitLabel({ ...book, unit: 'page', totalUnits: null, doneUnits: 120 })).toBe(
      'Page 121',
    );
  });

  it('has nothing next once finished', () => {
    expect(nextUnitLabel({ ...course, doneUnits: 23 })).toBeNull();
    expect(nextUnitLabel({ ...course, status: 'done' })).toBeNull();
  });
});

describe('isWebUrl', () => {
  it('accepts only http and https links', () => {
    expect(isWebUrl('https://youtube.com/playlist?list=abc')).toBe(true);
    expect(isWebUrl('http://example.com')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('data:text/html,hi')).toBe(false);
    expect(isWebUrl('youtube.com')).toBe(false);
    expect(isWebUrl('https://')).toBe(false);
  });
});

describe('libraryProgress', () => {
  const course: LibraryItem = {
    ...book,
    kind: 'course',
    unit: 'lesson',
    totalUnits: 23,
    doneUnits: 7,
  };

  it('gives the percent done and what is left', () => {
    expect(libraryProgress(course)).toEqual({ percent: 30, done: 7, total: 23, remaining: 16 });
    expect(remainingLabel(course)).toBe('16 lessons left');
    expect(remainingLabel({ ...course, doneUnits: 22 })).toBe('1 lesson left');
  });

  it('never rounds up to 100 before the end', () => {
    expect(libraryProgress({ ...course, doneUnits: 22 })?.percent).toBe(95);
    expect(libraryProgress({ ...course, totalUnits: 1000, doneUnits: 999 })?.percent).toBe(99);
    expect(libraryProgress({ ...course, doneUnits: 23, status: 'done' })?.percent).toBe(100);
  });

  it('has no percent without a total', () => {
    expect(libraryProgress({ ...course, totalUnits: null })).toBeNull();
    expect(remainingLabel({ ...course, totalUnits: null })).toBeNull();
  });
});

describe('summarizeLibrary', () => {
  const item = (id: string, extra: Partial<LibraryItem>): LibraryItem => ({
    ...book,
    id,
    title: id,
    ...extra,
  });

  it('counts each status and averages the ones in progress', () => {
    const summary = summarizeLibrary([
      item('a', { status: 'active', totalUnits: 10, doneUnits: 8 }),
      item('b', { status: 'active', totalUnits: 10, doneUnits: 2 }),
      item('c', { status: 'paused', totalUnits: 10, doneUnits: 9 }),
      item('d', { status: 'active', totalUnits: null, doneUnits: 40 }),
      item('e', { status: 'planned' }),
      item('f', { status: 'done', totalUnits: 10, doneUnits: 10 }),
    ]);
    expect(summary.inProgress.map(({ item }) => item.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(summary).toMatchObject({ active: 3, paused: 1, planned: 1, finished: 1 });
    expect(summary.averagePercent).toBe(63);
    expect(summary.almostDone).toBe(2);
  });

  it('has no average when nothing has a known total', () => {
    expect(
      summarizeLibrary([item('a', { status: 'active', totalUnits: null })]).averagePercent,
    ).toBeNull();
  });
});

describe('libraryDeadline', () => {
  const book = {
    id: 'b',
    kind: 'book' as const,
    title: 'Deep learning',
    author: '',
    url: '',
    unit: 'chapter' as const,
    totalUnits: 20,
    doneUnits: 8,
    position: '',
    notes: '',
    status: 'active' as const,
    createdAt: 0,
  };

  it('has nothing to say without a deadline or once finished', () => {
    expect(libraryDeadline(book, '2026-11-25')).toBeNull();
    expect(
      libraryDeadline({ ...book, deadline: '2026-11-30', status: 'done' }, '2026-11-25'),
    ).toBeNull();
  });

  it('counts down and works out the pace, today included', () => {
    // 12 chapters left over 6 days (25th to 30th).
    expect(libraryDeadline({ ...book, deadline: '2026-11-30' }, '2026-11-25')).toEqual({
      text: '5 days left',
      tone: 'later',
      daysLeft: 5,
      pace: 'About 2 chapters a day',
    });
    expect(
      libraryDeadline({ ...book, doneUnits: 18, deadline: '2026-11-30' }, '2026-11-25')?.pace,
    ).toBe('About 1 chapter every 3 days');
    expect(
      libraryDeadline({ ...book, doneUnits: 15, deadline: '2026-11-30' }, '2026-11-25')?.pace,
    ).toBe('About 1 chapter a day');
  });

  it('marks a passed deadline and drops the pace', () => {
    expect(libraryDeadline({ ...book, deadline: '2026-11-23' }, '2026-11-25')).toMatchObject({
      text: '2 days overdue',
      tone: 'overdue',
      pace: null,
    });
  });

  it('has no pace when the total is unknown', () => {
    expect(
      libraryDeadline({ ...book, totalUnits: null, deadline: '2026-11-26' }, '2026-11-25'),
    ).toMatchObject({ text: 'Due tomorrow', tone: 'soon', pace: null });
  });
});
