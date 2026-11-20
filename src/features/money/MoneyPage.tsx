import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { usePersistentState } from '../../components/usePersistentState';
import {
  formatTaka,
  monthLabel,
  monthOf,
  shiftMonth,
  type MoneyEntry,
  type MoneySection,
} from '../../domain/money';
import { useTrackerStore } from '../../store/trackerStore';
import { LockScreen } from '../badHabits/LockScreen';
import { PinDialog } from '../badHabits/PinDialog';
import { useLockSession, usePrivacyLocked } from '../badHabits/lockSession';
import { useToday } from '../progress/useNow';
import { useMoneyMonth } from '../progress/useMoney';
import { DayList } from './DayList';
import { EntryDialog } from './EntryDialog';
import { ImportDialog } from './ImportDialog';
import styles from './Money.module.css';
import { MoneyReport } from './MoneyReport';
import { QuickAdd } from './QuickAdd';
import { SectionCards } from './SectionCards';
import { SectionDialog } from './SectionDialog';

type View = 'month' | 'report';
type DialogState =
  | { type: 'section'; section: MoneySection | null }
  | { type: 'entry'; entry: MoneyEntry }
  | { type: 'import' }
  | { type: 'pin' }
  | null;

/** Starter sections, the way most people split a month's money. */
const STARTERS = [
  { name: 'Personal expense', icon: '👤', color: 'cobalt', carryOver: false },
  { name: 'Meal', icon: '🍚', color: 'moss', carryOver: false },
  { name: 'Fund', icon: '🏦', color: 'plum', carryOver: true },
] as const;

export function MoneyPage() {
  const today = useToday();
  const sections = useTrackerStore((state) => state.moneySections);
  const addMoneySection = useTrackerStore((state) => state.addMoneySection);
  const hasLock = useTrackerStore((state) => state.badHabitLock !== null);
  const locked = usePrivacyLocked();
  const lockNow = useLockSession((state) => state.lock);
  const [view, setView] = usePersistentState<View>('tenk.moneyView', 'month');
  const [month, setMonth] = useState(monthOf(today));
  const [dialog, setDialog] = useState<DialogState>(null);
  const summary = useMoneyMonth(month);
  const thisMonth = monthOf(today);

  // Unlocked money locks again on leaving this page or the app.
  useEffect(() => {
    const lockWhenHidden = () => {
      if (document.visibilityState === 'hidden') lockNow();
    };
    document.addEventListener('visibilitychange', lockWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', lockWhenHidden);
      lockNow();
    };
  }, [lockNow]);

  if (locked) {
    return (
      <div className={styles.page}>
        <LockScreen subject="Money" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Money</h1>
          <p className={styles.lede}>
            Budgets per section, every taka written down, and where it went.
          </p>
        </div>
        <div className={styles.headerActions}>
          {sections.length > 0 && (
            <fieldset className={styles.switch}>
              <legend className="visually-hidden">View</legend>
              {(['month', 'report'] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="money-view"
                    className="visually-hidden"
                    checked={view === value}
                    onChange={() => setView(value)}
                  />
                  {value === 'month' ? 'Month' : 'Report'}
                </label>
              ))}
            </fieldset>
          )}
          <Button size="sm" variant="quiet" onClick={() => setDialog({ type: 'import' })}>
            Import sheet
          </Button>
          {!hasLock && (
            <Button size="sm" variant="quiet" onClick={() => setDialog({ type: 'pin' })}>
              Lock with PIN
            </Button>
          )}
        </div>
      </header>

      {sections.length === 0 ? (
        <section className={styles.setup}>
          <h2>Set up your sections</h2>
          <p>
            A section is a pot of money with its own budget, like personal expenses, meals or a
            fund. Start with these three and change them any time, or import a month from your
            sheet.
          </p>
          <div className={styles.setupActions}>
            <Button
              variant="primary"
              onClick={() => {
                for (const starter of STARTERS) addMoneySection({ ...starter });
              }}
            >
              Start with Personal expense, Meal and Fund
            </Button>
            <Button onClick={() => setDialog({ type: 'section', section: null })}>
              Make my own
            </Button>
            <Button variant="quiet" onClick={() => setDialog({ type: 'import' })}>
              Import a sheet
            </Button>
          </div>
        </section>
      ) : view === 'report' ? (
        <MoneyReport today={today} />
      ) : (
        <>
          <QuickAdd today={today} />

          <div className={styles.monthBar}>
            <div className={styles.stepper}>
              <button
                type="button"
                onClick={() => setMonth(shiftMonth(month, -1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <h2>{monthLabel(month)}</h2>
              <button
                type="button"
                onClick={() => setMonth(shiftMonth(month, 1))}
                disabled={month >= thisMonth}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <p className={`tabular ${styles.totals}`}>
              <strong>{formatTaka(summary.spent)}</strong> spent of {formatTaka(summary.budget)}.{' '}
              <span data-over={summary.remaining < 0}>
                {summary.remaining < 0
                  ? `${formatTaka(-summary.remaining)} over`
                  : `${formatTaka(summary.remaining)} left`}
              </span>
            </p>
            <Button size="sm" onClick={() => setDialog({ type: 'section', section: null })}>
              Add section
            </Button>
          </div>

          <SectionCards
            month={summary}
            onEdit={(section) => setDialog({ type: 'section', section })}
          />

          <DayList
            month={summary}
            sections={sections}
            onEdit={(entry) => setDialog({ type: 'entry', entry })}
          />
        </>
      )}

      {dialog?.type === 'section' && (
        <SectionDialog section={dialog.section} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'entry' && (
        <EntryDialog entry={dialog.entry} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'import' && (
        <ImportDialog
          onClose={() => setDialog(null)}
          onImported={(imported) => {
            setMonth(imported);
            setView('month');
          }}
        />
      )}
      {dialog?.type === 'pin' && <PinDialog mode="set" onClose={() => setDialog(null)} />}
    </div>
  );
}
