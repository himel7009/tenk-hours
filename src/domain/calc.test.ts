import { describe, expect, it } from 'vitest';
import { evaluate, formatCalc } from './calc';

const value = (text: string) => {
  const result = evaluate(text);
  return result.ok ? result.value : result.error;
};

describe('evaluate', () => {
  it('does arithmetic in the right order', () => {
    expect(value('130 + 60 + 20')).toBe(210);
    expect(value('2 + 3 × 4')).toBe(14);
    expect(value('(2 + 3) × 4')).toBe(20);
    expect(value('7155 − 5738')).toBe(1417);
    expect(value('1417 ÷ 11')).toBe(128.82);
    expect(value('-5 + 2')).toBe(-3);
    expect(value('1,200 * 3')).toBe(3600);
    expect(value('0.1 + 0.2')).toBe(0.3);
  });

  it('treats percent the way phone calculators do', () => {
    expect(value('500 + 10%')).toBe(550);
    expect(value('500 - 10%')).toBe(450);
    expect(value('200 × 10%')).toBe(20);
    expect(value('10%')).toBe(0.1);
  });

  it('explains what is wrong', () => {
    expect(value('5 ÷ 0')).toBe('Cannot divide by zero');
    expect(value('5 +')).toBe('Unfinished');
    expect(value('(5 + 2')).toBe('A bracket is not closed');
    expect(value('5 & 2')).toBe('Only numbers and + − × ÷ % ( )');
    expect(value('alert(1)')).toBe('Only numbers and + − × ÷ % ( )');
  });

  it('formats results with Bangladeshi grouping', () => {
    expect(formatCalc(123456.5)).toBe('1,23,456.5');
  });
});
