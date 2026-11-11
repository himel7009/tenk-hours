import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import type { Session } from '../../domain/types';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { useToday } from '../progress/useNow';
import { SessionFields } from './SessionFields';
import styles from './sessions.module.css';
import { draftFromSession, validateDraft } from './sessionDraft';

interface SessionEditDialogProps {
  session: Session;
  onClose: () => void;
}

export function SessionEditDialog({ session, onClose }: SessionEditDialogProps) {
  const today = useToday();
  const updateSession = useTrackerStore((state) => state.updateSession);
  const deleteSession = useTrackerStore((state) => state.deleteSession);
  const toast = useToastStore((state) => state.show);
  const [draft, setDraft] = useState(() => draftFromSession(session));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateDraft(draft, today);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    updateSession(session.id, result.input);
    toast('Session updated');
    onClose();
  };

  const handleDelete = () => {
    deleteSession(session.id);
    toast('Session deleted');
    onClose();
  };

  return (
    <Dialog title="Edit session" onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <SessionFields draft={draft} today={today} onChange={setDraft} />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <Button variant="danger" onClick={handleDelete}>
            Delete session
          </Button>
          <span className={styles.spacer} />
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
