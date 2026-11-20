import { useState, type ChangeEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Select } from '../../components/Field';
import { fromDayKey } from '../../domain/dates';
import { formatTaka, monthLabel, type MoneySectionId } from '../../domain/money';
import { parseExpenseSheet, SheetImportError, type ImportedSheet } from '../../domain/moneyImport';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import formStyles from '../skills/SkillFormDialog.module.css';
import styles from './Money.module.css';

/** The largest sheet worth reading; a month is a few kilobytes. */
const MAX_BYTES = 2_000_000;

/**
 * Brings in a month from a spreadsheet saved as CSV. Shows what it found
 * before anything is saved, and which section each column goes into.
 */
export function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (month: string) => void;
}) {
  const sections = useTrackerStore((state) => state.moneySections);
  const importMoneySheet = useTrackerStore((state) => state.importMoneySheet);
  const toast = useToastStore((state) => state.show);
  const [sheet, setSheet] = useState<ImportedSheet | null>(null);
  const [targets, setTargets] = useState<Record<string, MoneySectionId | null>>({});
  const [error, setError] = useState<string | null>(null);

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) return setError('That file is too large for a monthly sheet.');
    try {
      const parsed = parseExpenseSheet(await file.text());
      setSheet(parsed);
      setError(null);
      // Match columns to sections of the same name; the rest become new ones.
      setTargets(
        Object.fromEntries(
          parsed.sections.map((part) => [
            part.name,
            sections.find((s) => s.name.toLowerCase() === part.name.toLowerCase())?.id ?? null,
          ]),
        ),
      );
    } catch (caught) {
      setSheet(null);
      setError(
        caught instanceof SheetImportError ? caught.message : 'That file could not be read as CSV.',
      );
    }
  };

  const run = () => {
    if (!sheet) return;
    const result = importMoneySheet(sheet, targets);
    toast(
      `Imported ${result.entries} entries${result.sections > 0 ? ` and ${result.sections} new sections` : ''}`,
    );
    onImported(sheet.month);
    onClose();
  };

  const lines = sheet?.sections.reduce((sum, part) => sum + part.items.length, 0) ?? 0;

  return (
    <Dialog title="Import a month from a sheet" onClose={onClose}>
      <div className={formStyles.form}>
        <p className={formStyles.hint}>
          In Google Sheets, choose File, Download, Comma separated values (.csv), then pick the file
          here. It reads a date column, a column per section, the budgets in the first row and a
          details column per section with one item per line, such as &ldquo;130 taka bus&rdquo;.
          Importing the same month again replaces what came from it before.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => void read(e)} />
        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        {sheet && (
          <>
            <h3 className={styles.importTitle}>
              {monthLabel(sheet.month)}: {lines} lines in {sheet.sections.length} sections
            </h3>
            <table className={styles.importTable}>
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Budget</th>
                  <th scope="col">Spent</th>
                  <th scope="col">Left</th>
                  <th scope="col">Goes into</th>
                </tr>
              </thead>
              <tbody>
                {sheet.sections.map((part) => (
                  <tr key={part.name}>
                    <th scope="row">{part.name}</th>
                    <td className="tabular">{formatTaka(part.budget)}</td>
                    <td className="tabular">{formatTaka(part.spent)}</td>
                    <td className="tabular">{formatTaka(part.budget - part.spent)}</td>
                    <td>
                      <Select
                        aria-label={`Section for ${part.name}`}
                        value={targets[part.name] ?? ''}
                        onChange={(e) =>
                          setTargets({ ...targets, [part.name]: e.target.value || null })
                        }
                      >
                        <option value="">New section</option>
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.icon} {section.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sheet.skipped.length > 0 && (
              <div className={styles.importNote}>
                <p>These lines have no amount, so they are left out:</p>
                <ul>
                  {sheet.skipped.map(({ day, text }) => (
                    <li key={`${day}${text}`}>
                      {fromDayKey(day).getDate()}: {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sheet.mismatches.length > 0 && (
              <p className={styles.importNote}>
                On {sheet.mismatches.length} days the items add up to more than the day&rsquo;s
                total. The items are used.
              </p>
            )}
            <p className={formStyles.hint}>
              Where a day&rsquo;s items add up to less than its total, the difference is kept as
              &ldquo;Not itemised&rdquo; so every total matches the sheet.
            </p>
          </>
        )}

        <div className={formStyles.actions}>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!sheet} onClick={run}>
            Import {lines > 0 ? `${lines} lines` : ''}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
