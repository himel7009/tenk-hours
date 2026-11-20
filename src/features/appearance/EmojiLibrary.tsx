import { useEffect, useMemo, useState } from 'react';
import { firstEmoji } from '../../domain/appearance';
import styles from './LookPicker.module.css';

/** Rows from scripts/build-emoji-library.mjs. */
type Row = [emoji: string, group: number, label: string, tags: string];

const GROUPS = [
  { icon: '😀', label: 'Smileys' },
  { icon: '🧑', label: 'People' },
  { icon: '🐻', label: 'Animals and nature' },
  { icon: '🍔', label: 'Food and drink' },
  { icon: '✈️', label: 'Travel and places' },
  { icon: '⚽', label: 'Activities' },
  { icon: '💡', label: 'Objects' },
  { icon: '🔣', label: 'Symbols' },
  { icon: '🏳️', label: 'Flags' },
];

let cache: Promise<Row[]> | null = null;
/** The list is about 40 kB, so it loads only when the picker opens. */
function loadLibrary(): Promise<Row[]> {
  cache ??= import('../../data/emojiLibrary.json').then((m) => m.default as Row[]);
  return cache;
}

/** Every emoji there is, searchable and in groups. */
export function EmojiLibrary({
  selected,
  used,
  ownerOf,
  onPick,
}: {
  selected: string;
  used: Set<string>;
  ownerOf: (icon: string) => string | undefined;
  onPick: (emoji: string) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(0);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let live = true;
    loadLibrary().then(
      (list) => live && setRows(list),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    if (rows === null) return [];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return rows.filter((row) => row[1] === group);
    return rows
      .filter((row) => {
        const words = `${row[2].toLowerCase()} ${row[3]}`;
        return terms.every((term) => words.includes(term));
      })
      .slice(0, 240);
  }, [rows, query, group]);

  const typedEmoji = firstEmoji(typed);

  return (
    <div className={styles.library}>
      <input
        type="search"
        className={styles.search}
        placeholder="Search, like book or rocket"
        aria-label="Search emoji"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {query === '' && (
        <div className={styles.groups} role="tablist" aria-label="Emoji groups">
          {GROUPS.map((g, index) => (
            <button
              key={g.label}
              type="button"
              role="tab"
              aria-selected={group === index}
              title={g.label}
              aria-label={g.label}
              className={styles.groupTab}
              onClick={() => setGroup(index)}
            >
              {g.icon}
            </button>
          ))}
        </div>
      )}

      <div className={styles.grid} aria-live="polite">
        {failed ? (
          <p className={styles.note}>
            The emoji list did not load. Check your connection, or type an emoji below.
          </p>
        ) : rows === null ? (
          <p className={styles.note}>Loading emoji…</p>
        ) : shown.length === 0 ? (
          <p className={styles.note}>No emoji match “{query}”. Try another word.</p>
        ) : (
          shown.map(([emoji, , label]) => {
            const owner = used.has(emoji) ? ownerOf(emoji) : undefined;
            return (
              <button
                key={emoji}
                type="button"
                className={styles.emoji}
                aria-pressed={selected === emoji}
                data-used={owner !== undefined || undefined}
                title={owner ? `${label}, used by ${owner}` : label}
                aria-label={owner ? `${emoji} ${label}, used by ${owner}` : `${emoji} ${label}`}
                onClick={() => onPick(emoji)}
              >
                {emoji}
              </button>
            );
          })
        )}
      </div>

      <div className={styles.own}>
        <input
          className={styles.search}
          aria-label="Type or paste any emoji"
          placeholder="Or type or paste any emoji"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
        <button
          type="button"
          className={styles.useOwn}
          disabled={typedEmoji === null}
          onClick={() => {
            if (typedEmoji === null) return;
            onPick(typedEmoji);
            setTyped('');
          }}
        >
          Use {typedEmoji ?? 'it'}
        </button>
      </div>
    </div>
  );
}
