import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './TrackerTabs.module.css';

export interface TabDefinition<Id extends string> {
  id: Id;
  label: string;
  count: number;
}

interface TrackerTabsProps<Id extends string> {
  tabs: TabDefinition<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  /** The selected tab's content. */
  children: ReactNode;
}

/** Accessible tabs: arrow keys move between them, as screen readers expect. */
export function TrackerTabs<Id extends string>({
  tabs,
  selected,
  onSelect,
  children,
}: TrackerTabsProps<Id>) {
  const refs = useRef(new Map<Id, HTMLButtonElement>());

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const target =
      event.key === 'Home'
        ? tabs[0]
        : event.key === 'End'
          ? tabs.at(-1)
          : step !== 0
            ? tabs[(index + step + tabs.length) % tabs.length]
            : undefined;
    if (!target) return;
    event.preventDefault();
    onSelect(target.id);
    refs.current.get(target.id)?.focus();
  };

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label="Your trackers" className={styles.list}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) refs.current.set(tab.id, node);
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
            <span className={`tabular ${styles.count}`}>{tab.count}</span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${selected}`}
        aria-labelledby={`tab-${selected}`}
        className={styles.panel}
      >
        {children}
      </div>
    </div>
  );
}
