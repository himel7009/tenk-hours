import { useState } from 'react';
import { Button } from '../../components/Button';
import type { LibraryItem, LibraryKind, LibraryStatus } from '../../domain/library';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './library.module.css';
import { LibraryItemDialog } from './LibraryItemDialog';
import { LibraryRow } from './LibraryRow';

const SECTIONS: { status: LibraryStatus; title: string; note?: string }[] = [
  { status: 'active', title: 'In progress' },
  {
    status: 'planned',
    title: 'Saved for later',
    note: 'Courses and books you want to take up. Start one when you are ready.',
  },
  { status: 'paused', title: 'Paused' },
  { status: 'done', title: 'Finished' },
];

type DialogState = { kind: LibraryKind; status?: LibraryStatus } | { item: LibraryItem } | null;

export function LibraryPage() {
  const library = useTrackerStore((state) => state.library);
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Library</h1>
          <p className={styles.lede}>
            The books and courses you are working through, where you got to in each, and the ones
            you have saved for later.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => setDialog({ kind: 'book' })}>Add book</Button>
          <Button onClick={() => setDialog({ kind: 'course' })}>Add course</Button>
          <Button onClick={() => setDialog({ kind: 'course', status: 'planned' })}>
            Save for later
          </Button>
        </div>
      </header>

      {library.length === 0 ? (
        <p className={styles.empty}>
          Nothing here yet. Add the book you are reading or the course you are taking, and keep your
          place in it. Found something for later? Save it so you don't lose it.
        </p>
      ) : (
        SECTIONS.map(({ status, title, note }) => {
          const items = library.filter((item) => item.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {title} <span className="tabular">{items.length}</span>
                {note && <p className={styles.sectionNote}>{note}</p>}
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
          <LibraryItemDialog
            kind={dialog.kind}
            status={dialog.status}
            onClose={() => setDialog(null)}
          />
        ))}
    </>
  );
}
