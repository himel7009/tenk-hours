import { Field, Input } from '../../components/Field';
import type { DayKey } from '../../domain/dates';
import styles from './SessionFields.module.css';
import type { SessionDraft } from './sessionDraft';

interface SessionFieldsProps {
  draft: SessionDraft;
  today: DayKey;
  onChange: (draft: SessionDraft) => void;
}

/** The inputs shared by logging a new session and editing an existing one. */
export function SessionFields({ draft, today, onChange }: SessionFieldsProps) {
  const set = (patch: Partial<SessionDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className={styles.fields}>
      <Field label="Hours">
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            placeholder="0"
            value={draft.hours}
            onChange={(event) => set({ hours: event.target.value })}
          />
        )}
      </Field>
      <Field label="Minutes">
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            placeholder="0"
            value={draft.minutes}
            onChange={(event) => set({ minutes: event.target.value })}
          />
        )}
      </Field>
      <Field label="Date">
        {(id) => (
          <Input
            id={id}
            type="date"
            max={today}
            value={draft.day}
            onChange={(event) => set({ day: event.target.value })}
          />
        )}
      </Field>
      <div className={styles.note}>
        <Field label="Note (optional)">
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={140}
              placeholder="What did you work on?"
              value={draft.note}
              onChange={(event) => set({ note: event.target.value })}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
