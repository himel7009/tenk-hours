import { describe, expect, it } from 'vitest';
import { isWebUrl, progressLabel, stepProgress, type LibraryItem } from './library';

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
