/**
 * A small calculator: + − × ÷, brackets, decimals and percent. It parses the
 * text itself rather than running it as code. Percent works the way phone
 * calculators do: 500 + 10% is 550, 500 − 10% is 450, and 200 × 10% is 20.
 */

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

type Token = { type: 'num'; value: number } | { type: 'op'; value: string };

const OPERATORS: Record<string, string> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  x: '*',
  '/': '/',
  '÷': '/',
  '%': '%',
  '(': '(',
  ')': ')',
};

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  const source = text.replace(/[,\s৳]/g, '');
  let i = 0;
  while (i < source.length) {
    const char = source[i]!;
    const number = /^\d*\.?\d+|^\d+\.?/.exec(source.slice(i));
    if (number) {
      tokens.push({ type: 'num', value: Number(number[0]) });
      i += number[0].length;
    } else if (OPERATORS[char]) {
      tokens.push({ type: 'op', value: OPERATORS[char] });
      i += 1;
    } else {
      return null;
    }
  }
  return tokens;
}

class CalcError extends Error {}

/** A value and whether it was written as a percent, which + and − treat specially. */
interface Operand {
  value: number;
  percent: boolean;
}

export function evaluate(text: string): CalcResult {
  const tokens = tokenize(text);
  if (tokens === null) return { ok: false, error: 'Only numbers and + − × ÷ % ( )' };
  if (tokens.length === 0) return { ok: false, error: '' };
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function expression(): Operand {
    let left = term();
    while (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = take()!.value;
      const right = term();
      const amount = right.percent ? (left.value * right.value) / 100 : right.value;
      left = { value: op === '+' ? left.value + amount : left.value - amount, percent: false };
    }
    return left;
  }

  function term(): Operand {
    let left = factor();
    while (peek()?.type === 'op' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = take()!.value;
      const right = factor();
      const value = right.percent ? right.value / 100 : right.value;
      if (op === '/' && value === 0) throw new CalcError('Cannot divide by zero');
      left = { value: op === '*' ? left.value * value : left.value / value, percent: false };
    }
    return left;
  }

  function factor(): Operand {
    const token = peek();
    if (token?.type === 'op' && (token.value === '-' || token.value === '+')) {
      take();
      const inner = factor();
      return { ...inner, value: token.value === '-' ? -inner.value : inner.value };
    }
    let operand: Operand;
    if (token?.type === 'num') {
      take();
      operand = { value: token.value, percent: false };
    } else if (token?.type === 'op' && token.value === '(') {
      take();
      operand = expression();
      if (take()?.value !== ')') throw new CalcError('A bracket is not closed');
      operand = { value: operand.value, percent: false };
    } else {
      throw new CalcError('Unfinished');
    }
    if (peek()?.type === 'op' && peek()!.value === '%') {
      take();
      return { value: operand.value, percent: true };
    }
    return operand;
  }

  try {
    const result = expression();
    if (position < tokens.length) throw new CalcError('Unfinished');
    // On its own, 10% is a tenth.
    const value = result.percent ? result.value / 100 : result.value;
    if (!Number.isFinite(value)) return { ok: false, error: 'Too big' };
    // Paisa is as fine as money goes; this also hides float dust like 0.1 + 0.2.
    return { ok: true, value: Math.round(value * 100) / 100 };
  } catch (error) {
    return { ok: false, error: error instanceof CalcError ? error.message : 'Unfinished' };
  }
}

const DISPLAY = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** "1,23,456.5" */
export const formatCalc = (value: number): string => DISPLAY.format(value);
