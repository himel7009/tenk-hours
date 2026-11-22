import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `wide` for grids and tables that need the room. */
  size?: 'normal' | 'wide';
}

/**
 * Modal built on the native <dialog>, which handles focus trapping, Escape and
 * the backdrop. Mount it to open it; unmount it (via onClose) to close it.
 */
export function Dialog({ title, onClose, children, size = 'normal' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-size={size}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click that lands on the dialog element itself is on the backdrop.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles.body}>
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
