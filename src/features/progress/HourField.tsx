import { useEffect, useRef } from 'react';
import { formatHours } from '../../domain/format';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './HourField.module.css';

const MAX_CELLS = 10_000;

interface HourFieldProps {
  loggedMinutes: number;
  targetHours: number;
}

interface FieldLayout {
  cells: number;
  columns: number;
  hoursPerCell: number;
}

/** One cell per hour up to 10,000 hours; beyond that cells stand for more. */
function layoutFor(targetHours: number): FieldLayout {
  const cells = Math.min(MAX_CELLS, Math.max(1, Math.ceil(targetHours)));
  const columns = cells <= 100 ? 10 : cells <= 2500 ? 50 : 100;
  return { cells, columns, hoursPerCell: targetHours / cells };
}

/**
 * The whole target drawn as a grid of hours. Drawn on a canvas because the
 * default target is 10,000 cells, which is too many DOM nodes to animate past.
 */
export function HourField({ loggedMinutes, targetHours }: HourFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Not used directly, but a theme change must trigger a redraw.
  const theme = useTrackerStore((state) => state.theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const { cells, columns, hoursPerCell } = layoutFor(targetHours);
      const rows = Math.ceil(cells / columns);
      const width = canvas.clientWidth;
      const size = width / columns;
      const height = size * rows;
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.height = `${height}px`;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(ratio, ratio);

      const computed = getComputedStyle(canvas);
      const filledColor = computed.getPropertyValue('--skill');
      const emptyColor = computed.getPropertyValue('--cell-empty');

      const filled = Math.min(cells, loggedMinutes / 60 / hoursPerCell);
      const whole = Math.floor(filled);
      const gap = Math.max(0.6, size * 0.16);
      const inner = size - gap;

      const paint = (index: number) =>
        context.fillRect(
          (index % columns) * size,
          Math.floor(index / columns) * size,
          inner,
          inner,
        );

      context.fillStyle = emptyColor;
      for (let index = whole; index < cells; index += 1) paint(index);

      context.fillStyle = filledColor;
      for (let index = 0; index < whole; index += 1) paint(index);

      // The hour in progress shows as a partly opaque cell.
      const partial = filled - whole;
      if (partial > 0 && whole < cells) {
        context.globalAlpha = 0.25 + partial * 0.6;
        paint(whole);
        context.globalAlpha = 1;
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', draw);
    return () => {
      observer.disconnect();
      scheme.removeEventListener('change', draw);
    };
  }, [loggedMinutes, targetHours, theme]);

  const { hoursPerCell } = layoutFor(targetHours);
  const unit =
    hoursPerCell === 1
      ? 'one hour'
      : `${hoursPerCell.toLocaleString(undefined, { maximumFractionDigits: 1 })} hours`;

  return (
    <figure className={styles.figure}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label={`${formatHours(loggedMinutes)} of ${targetHours.toLocaleString()} hours filled`}
      />
      <figcaption className={styles.caption}>Each square is {unit}.</figcaption>
    </figure>
  );
}
