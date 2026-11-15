import { useState } from 'react';
import { Button } from '../../components/Button';
import type { LibraryItem, LibraryKind, LibraryStatus } from '../../domain/library';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './library.module.css';
import { LibraryItemDialog } from './LibraryItemDialog';
import { LibraryRow } from './LibraryRow';

const SECTIONS: { status: LibraryStatus; title: string }[] = [
  { status: 'active', title: 'In progress' },
  { status: 'paused', title: 'Paused' },
  { status: 'done', title: 'Finished' },
];

type DialogState = { kind: LibraryKind } | { item: LibraryItem } | null;

export function LibraryPage() {
  const library = useTrackerStore((state) => state.library);
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Library</h1>
          <p className={styles.lede}>
            The books and courses you are working through, and where you got to in each.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => setDialog({ kind: 'book' })}>Add book</Button>
          <Button onClick={() => setDialog({ kind: 'course' })}>Add course</Button>
        </div>
      </header>

      {library.length === 0 ? (
        <p className={styles.empty}>
          Nothing here yet. Add the book you are reading or the course you are taking, and keep your
          place in it.
        </p>
      ) : (
        SECTIONS.map(({ status, title }) => {
          const items = library.filter((item) => item.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {title} <span className="tabular">{items.length}</span>
              </h2>
              <ul>
                {items.map((item) => (
                  <LibraryRow key={item.id} item={item} onEdit={() => setDialog({ item })} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {dialog &&
        ('item' in dialog ? (
          <LibraryItemDialog item={dialog.item} onClose={() => setDialog(null)} />
        ) : (
          <LibraryItemDialog kind={dialog.kind} onClose={() => setDialog(null)} />
        ))}
    </>
  );
}
