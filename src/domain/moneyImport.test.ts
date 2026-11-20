import { describe, expect, it } from 'vitest';
import { parseCsv, parseExpenseSheet, parseItems } from './moneyImport';

describe('parseCsv', () => {
  it('keeps quoted commas and line breaks in one cell', () => {
    expect(parseCsv('a,"b, c\nd",e\r\nf,g,h')).toEqual([
      ['a', 'b, c\nd', 'e'],
      ['f', 'g', 'h'],
    ]);
  });
});

describe('parseItems', () => {
  it('reads one item per line or comma, amount first or last', () => {
    const { items, skipped } = parseItems(
      '100 taka(Chips)\n40 taka ( daal er bora , alur chop)\nPush 390\nmechanic 140 taka, 20 taka baat',
    );
    expect(items).toEqual([
      { amount: 10000, note: 'Chips' },
      { amount: 4000, note: 'daal er bora , alur chop' },
      { amount: 39000, note: 'Push' },
      { amount: 14000, note: 'mechanic' },
      { amount: 2000, note: 'baat' },
    ]);
    expect(skipped).toEqual([]);
  });

  it('splits two items written on one line, but not numbers inside a note', () => {
    expect(parseItems('5 taka tip 20 taka baat').items).toEqual([
      { amount: 500, note: 'tip' },
      { amount: 2000, note: 'baat' },
    ]);
    expect(parseItems('dim 2 hali 100 taka').items).toEqual([
      { amount: 10000, note: 'dim 2 hali' },
    ]);
  });

  it('skips lines with no amount', () => {
    expect(parseItems('forgot to write these down').skipped).toEqual([
      'forgot to write these down',
    ]);
  });
});

const SHEET = [
  'March,Personal Expense,Meal,Days,PE remaining,Meal Remaining,PE Budget,Meal Budget,March,PE details,Meal Details,Days',
  '01/03/27,,,Monday,500,100,1000,300,01/03/27,,,Monday',
  '02/03/27,300,,Tuesday,,,,,02/03/27,"100 taka bus\n150 taka book",,Tuesday',
  '03/03/27,200,200,Wednesday,,,,,03/03/27,200 taka shoes,"dim 1 hali 60 taka\nrice 140",Wednesday',
  'Total,500,200,,,,,,,,,',
].join('\n');

describe('parseExpenseSheet', () => {
  it('reads sections, budgets and items, and keeps day totals whole', () => {
    const sheet = parseExpenseSheet(SHEET);
    expect(sheet.month).toBe('2027-03');
    const [pe, meal] = sheet.sections;
    expect(pe).toMatchObject({ name: 'Personal Expense', budget: 100000, spent: 50000 });
    // 300 on the 2nd, but items only list 250: the rest is kept as not itemised.
    expect(pe?.items.map((item) => [item.day, item.amount / 100, item.note])).toEqual([
      ['2027-03-02', 100, 'bus'],
      ['2027-03-02', 150, 'book'],
      ['2027-03-02', 50, 'Not itemised'],
      ['2027-03-03', 200, 'shoes'],
    ]);
    expect(meal).toMatchObject({ name: 'Meal', budget: 30000, spent: 20000 });
  });

  it('gives the same ids each time, so importing again replaces', () => {
    const ids = (text: string) => parseExpenseSheet(text).sections[0]!.items.map((item) => item.id);
    expect(ids(SHEET)).toEqual(ids(SHEET));
  });

  it('refuses something that is not an expense sheet', () => {
    expect(() => parseExpenseSheet('name,email\nHimel,x')).toThrow(/does not look like/);
  });
});
