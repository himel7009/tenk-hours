import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { evaluate, formatCalc } from '../../domain/calc';
import styles from './Calculator.module.css';

const KEYS = [
  ['C', '(', ')', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '%', '='],
] as const;

/** Keys typed on a keyboard, as the calculator writes them. */
const TYPED: Record<string, string> = {
  '*': '×',
  x: '×',
  '/': '÷',
  '-': '−',
  '+': '+',
  '%': '%',
  '(': '(',
  ')': ')',
  '.': '.',
};

const OPERATOR = /[+−×÷]$/;

/**
 * A calculator on the Money page, so a sum never needs another app. The
 * result can go straight into the expense line.
 */
export function Calculator({
  onClose,
  onUse,
}: {
  onClose: () => void;
  /** Called with the result in taka, to write it down as an expense. */
  onUse: (amount: number) => void;
}) {
  const [text, setText] = useState('');
  const [tape, setTape] = useState<{ sum: string; value: number }[]>([]);
  const result = evaluate(text);
  const preview = result.ok ? formatCalc(result.value) : '';

  const press = (key: string) => {
    if (key === 'C') return setText('');
    if (key === '⌫') return setText((current) => current.slice(0, -1));
    if (key === '=') {
      if (!result.ok) return;
      setTape((current) => [{ sum: text, value: result.value }, ...current].slice(0, 6));
      return setText(String(result.value));
    }
    setText((current) => {
      // A second operator in a row replaces the first: 5 + × 2 becomes 5 × 2.
      if (OPERATOR.test(key) && OPERATOR.test(current) && key !== '−') {
        return current.slice(0, -1) + key;
      }
      return (current + key).slice(0, 120);
    });
  };

  // Type on the keyboard as well as tapping.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = /^\d$/.test(event.key)
        ? event.key
        : event.key === 'Enter' || event.key === '='
          ? '='
          : event.key === 'Backspace'
            ? '⌫'
            : event.key === 'Delete'
              ? 'C'
              : TYPED[event.key];
      if (!key) return;
      // Keep Enter from also pressing whichever button has focus.
      event.preventDefault();
      press(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Dialog title="Calculator" onClose={onClose}>
      <div className={styles.calculator}>
        <div className={styles.screen} aria-live="polite">
          <p className={`tabular ${styles.sum}`} aria-label="Sum">
            {text || '0'}
          </p>
          <p className={`tabular ${styles.result}`}>
            {text === ''
              ? ''
              : result.ok
                ? `= ${preview}`
                : result.error && result.error !== 'Unfinished'
                  ? result.error
                  : ''}
          </p>
        </div>

        <div className={styles.keys}>
          {KEYS.flat().map((key) => (
            <button
              key={key}
              type="button"
              className={styles.key}
              data-kind={
                key === '='
                  ? 'equals'
                  : /[+−×÷%()]/.test(key)
                    ? 'op'
                    : key === 'C'
                      ? 'clear'
                      : 'digit'
              }
              onClick={() => press(key)}
              aria-label={
                {
                  '÷': 'divide',
                  '×': 'times',
                  '−': 'minus',
                  '+': 'plus',
                  '=': 'equals',
                  C: 'clear',
                  '%': 'percent',
                }[key as string] ?? key
              }
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.key} ${styles.back}`}
            data-kind="clear"
            onClick={() => press('⌫')}
            aria-label="Delete last"
          >
            ⌫
          </button>
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            disabled={!result.ok || result.value <= 0}
            onClick={() => {
              if (result.ok) onUse(result.value);
            }}
          >
            Write {result.ok && result.value > 0 ? `৳${preview}` : 'it'} down as an expense
          </Button>
        </div>

        {tape.length > 0 && (
          <div className={styles.tape}>
            <h3>Earlier</h3>
            <ul>
              {tape.map((line, index) => (
                <li key={index}>
                  <button type="button" onClick={() => setText(String(line.value))}>
                    <span className="tabular">{line.sum}</span>
                    <strong className="tabular">= {formatCalc(line.value)}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
