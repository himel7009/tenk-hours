import { describe, expect, it } from 'vitest';
import {
  buildMoneyReport,
  dayRuns,
  formatTaka,
  monthRange,
  parseAmount,
  parseQuickEntry,
  shiftMonth,
  summarizeMoneyMonth,
  tagOf,
  type MoneyEntry,
  type MoneySection,
} from './money';
import { periodContaining } from './report';

const section = (id: string, carryOver = false): MoneySection => ({
  id,
  name: id,
  icon: '💼',
  color: 'cobalt',
  carryOver,
  createdAt: 0,
});
let n = 0;
const entry = (
  sectionId: string,
  kind: MoneyEntry['kind'],
  day: string,
  taka: number,
  note = '',
  toSectionId: string | null = null,
): MoneyEntry => ({
  id: `e${(n += 1)}`,
  sectionId,
  kind,
  toSectionId,
  day,
  amount: taka * 100,
  note,
  createdAt: n,
});

describe('amounts', () => {
  it('formats taka the Bangladeshi way', () => {
    expect(formatTaka(141700)).toBe('৳1,417');
    expect(formatTaka(1234567800)).toBe('৳1,23,45,678');
    expect(formatTaka(1150)).toBe('৳11.50');
    expect(formatTaka(-10800)).toBe('−৳108');
  });

  it('reads amounts and quick entries', () => {
    expect(parseAmount('1,200')).toBe(120000);
    expect(parseAmount('11.5')).toBe(1150);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseQuickEntry('130 bus')).toEqual({ amount: 13000, note: 'bus' });
    expect(parseQuickEntry('bus 130')).toEqual({ amount: 13000, note: 'bus' });
    expect(parseQuickEntry('130 taka bus')).toEqual({ amount: 13000, note: 'bus' });
    expect(parseQuickEntry('Gulsha mach 1 kg 938 taka')).toEqual({
      amount: 93800,
      note: 'Gulsha mach 1 kg',
    });
    expect(parseQuickEntry('bus')).toBeNull();
  });
});

describe('tagOf', () => {
  it('recognises the words people write', () => {
    expect(tagOf('Rickshaw').id).toBe('transport');
    expect(tagOf('Bus bara').id).toBe('transport');
    expect(tagOf('Gulsha mach 1 kg').id).toBe('groceries');
    expect(tagOf('TuTu Phone Recharge').id).toBe('phone');
    expect(tagOf('bkash Charge').id).toBe('fees');
    expect(tagOf('Dokhinaa').id).toBe('giving');
    expect(tagOf('mechanique').id).toBe('other');
  });
});

describe('months', () => {
  it('knows month lengths and steps across years', () => {
    expect(monthRange('2026-11')).toEqual({ start: '2026-11-01', end: '2026-11-30', days: 30 });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('summarizeMoneyMonth', () => {
  const pe = section('pe');
  const meal = section('meal');
  const fund = section('fund', true);

  it('works out budget, spending and what is left, with moves between sections', () => {
    const entries = [
      entry('pe', 'add', '2026-11-01', 7155),
      entry('meal', 'add', '2026-11-01', 1000),
      entry('fund', 'add', '2026-11-01', 4000),
      entry('pe', 'spend', '2026-11-03', 560, 'snacks'),
      entry('fund', 'move', '2026-11-16', 1000, 'For meal', 'meal'),
      entry('meal', 'spend', '2026-11-16', 2108, 'bazar'),
    ];
    const month = summarizeMoneyMonth([pe, meal, fund], entries, '2026-11', '2026-11-20');
    const [p, m, f] = month.sections;
    expect(p).toMatchObject({ budget: 715500, spent: 56000, remaining: 659500 });
    expect(m).toMatchObject({ budget: 200000, movedIn: 100000, spent: 210800, remaining: -10800 });
    expect(f).toMatchObject({ budget: 300000, movedOut: 100000, spent: 0, remaining: 300000 });
    // Moving money is not spending.
    expect(month.spent).toBe(266800);
    expect(m?.dailyAllowance).toBeNull();
    // 11 days left including today.
    expect(p?.dailyAllowance).toBe(59900);
  });

  it('carries a balance over only for sections that ask for it', () => {
    const entries = [
      entry('pe', 'add', '2026-10-01', 5000),
      entry('pe', 'spend', '2026-10-10', 3000),
      entry('fund', 'add', '2026-10-01', 4000),
      entry('fund', 'spend', '2026-10-20', 500),
    ];
    const month = summarizeMoneyMonth([pe, fund], entries, '2026-11', '2026-11-05');
    expect(month.sections[0]).toMatchObject({ opening: 0, remaining: 0 });
    expect(month.sections[1]).toMatchObject({ opening: 350000, remaining: 350000 });
  });

  it('warns when the money will run out before the month ends', () => {
    const entries = [
      entry('pe', 'add', '2026-11-01', 3000),
      entry('pe', 'spend', '2026-11-05', 1000),
    ];
    // 1000 over 10 days is 100 a day; 2000 left lasts 20 days, so it is fine.
    expect(
      summarizeMoneyMonth([pe], entries, '2026-11', '2026-11-10').sections[0]?.runsOutOn,
    ).toBeNull();
    // 1000 over 5 days is 200 a day; 2000 left lasts 10 days: the 15th.
    expect(summarizeMoneyMonth([pe], entries, '2026-11', '2026-11-05').sections[0]?.runsOutOn).toBe(
      '2026-11-15',
    );
  });

  it('lists days with entries newest first and the days with nothing written down', () => {
    const entries = [
      entry('pe', 'spend', '2026-11-02', 10),
      entry('pe', 'spend', '2026-11-04', 20),
    ];
    const month = summarizeMoneyMonth([pe], entries, '2026-11', '2026-11-05');
    expect(month.days.map((d) => d.day)).toEqual(['2026-11-04', '2026-11-02']);
    expect(month.untracked).toEqual(['2026-11-01', '2026-11-03', '2026-11-05']);
    expect(dayRuns(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-14'])).toEqual([
      { from: '2026-11-09', to: '2026-11-11' },
      { from: '2026-11-14', to: '2026-11-14' },
    ]);
  });
});

describe('buildMoneyReport', () => {
  it('adds up a week by section and tag and compares it with last week so far', () => {
    const pe = section('pe');
    const entries = [
      entry('pe', 'spend', '2026-11-16', 130, 'bus'),
      entry('pe', 'spend', '2026-11-17', 40, 'rickshaw'),
      entry('pe', 'spend', '2026-11-18', 297, 'Mobile Recharge'),
      entry('pe', 'spend', '2026-11-10', 100, 'bus'),
      entry('pe', 'spend', '2026-11-14', 900, 'shoes'),
      entry('pe', 'add', '2026-11-16', 1000),
    ];
    const week = periodContaining('week', '2026-11-18');
    const report = buildMoneyReport([pe], entries, week, '2026-11-18');
    expect(report.spent).toBe(46700);
    // Monday to Wednesday of last week only.
    expect(report.previousSpent).toBe(10000);
    expect(report.byTag.map((t) => [t.tag.id, t.spent])).toEqual([
      ['phone', 29700],
      ['transport', 17000],
    ]);
    expect(report.largest[0]?.note).toBe('Mobile Recharge');
    expect(report.added).toBe(100000);
    expect(report.biggestDay).toEqual({ day: '2026-11-18', spent: 29700 });
  });

  it('reports a single day', () => {
    const pe = section('pe');
    const day = periodContaining('day', '2026-11-17');
    const report = buildMoneyReport(
      [pe],
      [entry('pe', 'spend', '2026-11-17', 35, 'nasta')],
      day,
      '2026-11-20',
    );
    expect(report.days).toHaveLength(1);
    expect(report.spent).toBe(3500);
  });
});
