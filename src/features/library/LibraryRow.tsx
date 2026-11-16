import { Button } from '../../components/Button';
import {
  progressFraction,
  progressLabel,
  stepProgress,
  UNIT_LABELS,
  type LibraryItem,
} from '../../domain/library';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './library.module.css';

const ICONS = { book: '📖', course: '🎓' } as const;
const COLORS = { book: 'teal', course: 'plum' } as const;

interface LibraryRowProps {
  item: LibraryItem;
  onEdit: () => void;
}

export function LibraryRow({ item, onEdit }: LibraryRowProps) {
  const updateLibraryItem = useTrackerStore((state) => state.updateLibraryItem);
  const toast = useToastStore((state) => state.show);

  const fraction = progressFraction(item);
  // Pages move too slowly one at a time.
  const stepSize = item.unit === 'page' ? 10 : 1;
  const { one, many } = UNIT_LABELS[item.unit];
  const stepLabel = `${stepSize} ${stepSize === 1 ? one : many}`;

  const step = (by: number) => {
    const next = stepProgress(item, by);
    updateLibraryItem(item.id, next);
    if (next.status === 'done' && item.status !== 'done') toast(`Finished ${item.title}`);
  };

  const startNow = () => {
    updateLibraryItem(item.id, { ...item, status: 'active' });
    toast(`Moved ${item.title} to in progress`);
  };

  return (
    <li className={styles.row} data-color={COLORS[item.kind]}>
      <span className={styles.icon} aria-hidden="true">
        {ICONS[item.kind]}
      </span>

      <div className={styles.main}>
        <h3 className={styles.title}>{item.title}</h3>
        {(item.author || item.url) && (
          <p className={styles.byline}>
            {item.author}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                Open {item.kind}
              </a>
            )}
          </p>
        )}

        {item.status !== 'planned' && (
          <p className={`tabular ${styles.progress}`}>{progressLabel(item)}</p>
        )}
        {fraction !== null && item.status !== 'planned' && (
          <div className={styles.bar} aria-hidden="true">
            <div className={styles.barFill} style={{ width: `${fraction * 100}%` }} />
          </div>
        )}

        {item.position && item.status !== 'done' && (
          <p className={styles.position}>
            <span>You are at</span> {item.position}
          </p>
        )}
        {item.notes && <p className={styles.notes}>{item.notes}</p>}
      </div>

      <div className={styles.rowActions}>
        {item.status === 'planned' && (
          <Button size="sm" variant="primary" onClick={startNow}>
            Start now
          </Button>
        )}
        {(item.status === 'active' || item.status === 'paused') && (
          <>
            <Button
              size="sm"
              onClick={() => step(-stepSize)}
              disabled={item.doneUnits === 0}
              aria-label={`Back ${stepLabel}`}
            >
              −
            </Button>
            <Button size="sm" onClick={() => step(stepSize)}>
              +{stepLabel}
            </Button>
          </>
        )}
        <Button size="sm" variant="quiet" onClick={onEdit} aria-label={`Edit ${item.title}`}>
          Edit
        </Button>
      </div>
    </li>
  );
}
