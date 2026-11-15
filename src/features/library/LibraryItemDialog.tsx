import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field, Input, Select, Textarea } from '../../components/Field';
import {
  isWebUrl,
  LIBRARY_LIMITS,
  UNIT_LABELS,
  UNITS_FOR_KIND,
  type LibraryItem,
  type LibraryKind,
  type LibraryStatus,
  type LibraryUnit,
} from '../../domain/library';
import { useToastStore } from '../../store/toastStore';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './library.module.css';

const COPY: Record<
  LibraryKind,
  { noun: string; add: string; title: string; author: string; link: string; position: string }
> = {
  book: {
    noun: 'book',
    add: 'Add a book',
    title: 'Deep Learning with Python',
    author: 'Author',
    link: 'Where you read it, if online',
    position: 'Section 5.2, page 143',
  },
  course: {
    noun: 'course',
    add: 'Add a course',
    title: 'Neural Networks: Zero to Hero',
    author: 'Channel or teacher',
    link: 'The playlist or course page',
    position: 'Video 12 at 34:10',
  },
};

const STATUS_LABELS: Record<LibraryStatus, string> = {
  active: 'In progress',
  paused: 'Paused',
  done: 'Finished',
};

type LibraryItemDialogProps = { onClose: () => void } & (
  | { /** The book or course to edit. */ item: LibraryItem; kind?: never }
  | { /** What to create. */ kind: LibraryKind; item?: never }
);

export function LibraryItemDialog(props: LibraryItemDialogProps) {
  const { item, onClose } = props;
  const kind = props.item ? props.item.kind : props.kind;
  const copy = COPY[kind];
  const units = UNITS_FOR_KIND[kind];

  const addLibraryItem = useTrackerStore((state) => state.addLibraryItem);
  const updateLibraryItem = useTrackerStore((state) => state.updateLibraryItem);
  const deleteLibraryItem = useTrackerStore((state) => state.deleteLibraryItem);
  const toast = useToastStore((state) => state.show);

  const [title, setTitle] = useState(item?.title ?? '');
  const [author, setAuthor] = useState(item?.author ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [unit, setUnit] = useState<LibraryUnit>(item?.unit ?? units[0]!);
  const [total, setTotal] = useState(item?.totalUnits?.toString() ?? '');
  const [done, setDone] = useState(item ? String(item.doneUnits) : '');
  const [position, setPosition] = useState(item?.position ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [status, setStatus] = useState<LibraryStatus>(item?.status ?? 'active');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { many } = UNIT_LABELS[unit];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    const totalUnits = total === '' ? null : Number(total);
    const doneUnits = done === '' ? 0 : Number(done);

    if (trimmedTitle === '') {
      setError(`Give the ${copy.noun} a title.`);
      return;
    }
    if (trimmedUrl !== '' && !isWebUrl(trimmedUrl)) {
      setError('Enter the link in full, starting with https://');
      return;
    }
    if (
      totalUnits !== null &&
      (!Number.isInteger(totalUnits) || totalUnits < 1 || totalUnits > LIBRARY_LIMITS.units)
    ) {
      setError(`Enter the total number of ${many} as a whole number, or leave it empty.`);
      return;
    }
    if (!Number.isInteger(doneUnits) || doneUnits < 0 || doneUnits > LIBRARY_LIMITS.units) {
      setError(`Enter the ${many} you have finished as a whole number.`);
      return;
    }
    if (totalUnits !== null && doneUnits > totalUnits) {
      setError(`You cannot have finished more ${many} than there are.`);
      return;
    }

    const finished = totalUnits !== null && doneUnits === totalUnits;
    const input = {
      kind,
      title: trimmedTitle,
      author: author.trim(),
      url: trimmedUrl,
      unit,
      totalUnits,
      doneUnits,
      position: position.trim(),
      notes: notes.trim(),
      status: finished ? 'done' : status,
    } satisfies Omit<LibraryItem, 'id' | 'createdAt'>;

    if (item) {
      updateLibraryItem(item.id, input);
      toast('Changes saved');
    } else {
      addLibraryItem(input);
      toast(`Added ${trimmedTitle}`);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!item) return;
    deleteLibraryItem(item.id);
    toast(`Deleted ${item.title}`);
    onClose();
  };

  return (
    <Dialog title={item ? `Edit ${copy.noun}` : copy.add} onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={LIBRARY_LIMITS.title}
              placeholder={copy.title}
              autoFocus={!item}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>

        <Field label={`${copy.author} (optional)`}>
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={LIBRARY_LIMITS.author}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          )}
        </Field>

        <Field label="Link (optional)" hint={copy.link}>
          {(id) => (
            <Input
              id={id}
              type="url"
              inputMode="url"
              maxLength={LIBRARY_LIMITS.url}
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          )}
        </Field>

        <div className={styles.numbers}>
          {units.length > 1 && (
            <Field label="Count progress in">
              {(id) => (
                <Select
                  id={id}
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as LibraryUnit)}
                >
                  {units.map((option) => (
                    <option key={option} value={option}>
                      {UNIT_LABELS[option].many}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label={`Finished ${many}`}>
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={done}
                onChange={(event) => setDone(event.target.value)}
              />
            )}
          </Field>
          <Field label={`Total ${many}`}>
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Unknown"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Where you are (optional)" hint="A bookmark in your own words.">
          {(id) => (
            <Input
              id={id}
              type="text"
              maxLength={LIBRARY_LIMITS.position}
              placeholder={copy.position}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
          )}
        </Field>

        <Field label="Notes (optional)">
          {(id) => (
            <Textarea
              id={id}
              maxLength={LIBRARY_LIMITS.notes}
              placeholder="Things to remember, what to revisit, what comes next"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          )}
        </Field>

        <Field label="Status">
          {(id) => (
            <Select
              id={id}
              value={status}
              onChange={(event) => setStatus(event.target.value as LibraryStatus)}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.dialogActions}>
          {item &&
            (confirmingDelete ? (
              <Button variant="danger" onClick={handleDelete}>
                Confirm delete
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete {copy.noun}
              </Button>
            ))}
          <span className={styles.spacer} />
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {item ? 'Save changes' : `Add ${copy.noun}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
