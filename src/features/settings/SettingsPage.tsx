import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/Button';
import { BackupError, createBackup, parseBackup } from '../../data/backup';
import { todayKey } from '../../domain/dates';
import type { Theme } from '../../domain/types';
import { isCloudEnabled } from '../../sync/supabaseClient';
import { useAccountStore } from '../../store/accountStore';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import { AccountSection } from '../account/AccountSection';
import styles from './SettingsPage.module.css';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Match device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsPage() {
  const theme = useTrackerStore((state) => state.theme);
  const setTheme = useTrackerStore((state) => state.setTheme);
  const replaceData = useTrackerStore((state) => state.replaceData);
  const toast = useToastStore((state) => state.show);
  const signedIn = useAccountStore((state) => state.user !== null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    const { skills, sessions } = useTrackerStore.getState();
    const blob = new Blob([JSON.stringify(createBackup(skills, sessions), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tenk-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const data = parseBackup(await file.text());
      const confirmed = window.confirm(
        `Replace everything in Tenk${signedIn ? ', on all your devices,' : ''} with this backup (${data.skills.length} skills, ${data.sessions.length} sessions)?`,
      );
      if (!confirmed) return;
      replaceData(data);
      setImportError(null);
      toast('Backup restored');
    } catch (error) {
      setImportError(error instanceof BackupError ? error.message : 'This file could not be read.');
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.section}>
        <h2>Appearance</h2>
        <div className={styles.segmented} role="radiogroup" aria-label="Theme">
          {THEMES.map(({ value, label }) => (
            <label key={value} className={styles.segment}>
              <input
                type="radio"
                name="theme"
                className="visually-hidden"
                checked={theme === value}
                onChange={() => setTheme(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {isCloudEnabled && (
        <section className={styles.section}>
          <h2>Account</h2>
          <AccountSection />
        </section>
      )}

      <section className={styles.section}>
        <h2>Your data</h2>
        <p className={styles.help}>
          {signedIn
            ? 'Your skills and sessions are saved to your account. A backup file is an extra copy you keep yourself.'
            : 'Tenk keeps your skills and sessions in this browser only. Download a backup to move them to another device or to keep a copy safe.'}
        </p>
        <div className={styles.actions}>
          <Button onClick={handleExport}>Download backup</Button>
          <Button onClick={() => fileInput.current?.click()}>Restore from backup</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Backup file"
            onChange={(event) => void handleImport(event)}
          />
        </div>
        {importError && (
          <p className={styles.error} role="alert">
            {importError}
          </p>
        )}
      </section>
    </div>
  );
}
