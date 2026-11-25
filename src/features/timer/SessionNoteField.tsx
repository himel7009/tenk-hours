import { useId } from 'react';
import { Input } from '../../components/Field';
import { SESSION_NOTE_MAX } from '../../domain/timer';
import type { SkillId } from '../../domain/types';
import { useTodoBoard } from '../progress/useTodos';
import styles from './SessionNoteField.module.css';

interface SessionNoteFieldProps {
  skillId: SkillId;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

/**
 * "What are you working on?", asked before a timer starts. Today's open
 * to-dos for the same skill are offered as suggestions.
 */
export function SessionNoteField({ skillId, value, onChange, autoFocus }: SessionNoteFieldProps) {
  const id = useId();
  const board = useTodoBoard();
  const suggestions =
    board.today.find((group) => group.target.key === `skill:${skillId}`)?.items ?? [];
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        What are you working on?
      </label>
      <Input
        id={id}
        value={value}
        maxLength={SESSION_NOTE_MAX}
        placeholder={suggestions[0]?.todo.title ?? 'Chapter 3, practice problems'}
        list={suggestions.length > 0 ? `${id}-todos` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      {suggestions.length > 0 && (
        <datalist id={`${id}-todos`}>
          {suggestions.map(({ todo }) => (
            <option key={todo.id} value={todo.title} />
          ))}
        </datalist>
      )}
    </div>
  );
}
