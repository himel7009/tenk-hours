import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { formatDuration } from '../../domain/format';
import type { Skill } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import { SessionFields } from './SessionFields';
import styles from './sessions.module.css';
import { emptyDraft, validateDraft } from './sessionDraft';

interface LogTimeFormProps {
  skill: Skill;
}

export function LogTimeForm({ skill }: LogTimeFormProps) {
  const today = useToday();
  const logSession = useTrackerStore((state) => state.logSession);
  const toast = useToastStore((state) => state.show);
  const [draft, setDraft] = useState(() => emptyDraft(today));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateDraft(draft, today);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    logSession(skill.id, result.input);
    toast(`Logged ${formatDuration(result.input.minutes)} to ${skill.name}`);
    setDraft(emptyDraft(today));
    setError(null);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <SessionFields draft={draft} today={today} onChange={setDraft} />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div>
        <Button type="submit">Log time</Button>
      </div>
    </form>
  );
}
