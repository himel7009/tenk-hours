import { useId, useState } from 'react';
import { normalizeHex } from '../../domain/appearance';
import { SKILL_COLORS, isCustomColor } from '../../domain/types';
import { customColorCss } from './customColors';
import { EmojiLibrary } from './EmojiLibrary';
import type { LookState } from './useLook';
import styles from './LookPicker.module.css';

const COLOR_NAMES: Record<(typeof SKILL_COLORS)[number], string> = {
  cobalt: 'Cobalt',
  persimmon: 'Persimmon',
  moss: 'Moss',
  plum: 'Plum',
  teal: 'Teal',
  rose: 'Rose',
  gold: 'Gold',
  indigo: 'Indigo',
  olive: 'Olive',
  fuchsia: 'Fuchsia',
  sky: 'Sky',
  cocoa: 'Cocoa',
};

/**
 * The icon and colour fields shared by every form. They arrive filled in
 * (see useLook); the quick row, the full emoji library and the custom colour
 * are there for changing them.
 */
export function LookPicker({ look }: { look: LookState }) {
  const [browsing, setBrowsing] = useState(false);
  const id = useId();
  const { icon, color } = look;
  const iconOwner = look.ownerOf(`icon:${icon}`);
  const colorOwner = look.ownerOf(`color:${color}`);
  const custom = isCustomColor(color);
  // The quick row always holds the current icon, then fresh ideas.
  const quick = [icon, ...look.ideas.filter((idea) => idea !== icon)].slice(0, 9);

  return (
    <div className={styles.look} data-color={color}>
      {/* Lets a custom colour show before it is saved. */}
      {custom && <style>{customColorCss([color])}</style>}

      <fieldset className={styles.field}>
        <legend>Icon</legend>
        <div className={styles.quick} role="group" aria-label="Suggested icons">
          {quick.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.emoji}
              aria-pressed={icon === option}
              aria-label={option}
              onClick={() => look.setIcon(option)}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            className={styles.more}
            aria-expanded={browsing}
            aria-controls={`${id}-library`}
            onClick={() => setBrowsing((open) => !open)}
          >
            {browsing ? 'Close emoji' : 'All emoji'}
          </button>
        </div>
        <p className={styles.hint}>
          {iconOwner
            ? `${icon} is also used by ${iconOwner}.`
            : look.autoIcon
              ? 'Picked from the name and not used anywhere else. Choose another any time.'
              : 'Not used anywhere else.'}
        </p>
        {browsing && (
          <div id={`${id}-library`}>
            <EmojiLibrary
              selected={icon}
              used={look.usedIcons}
              ownerOf={(emoji) => look.ownerOf(`icon:${emoji}`)}
              onPick={(emoji) => {
                look.setIcon(emoji);
                setBrowsing(false);
              }}
            />
          </div>
        )}
      </fieldset>

      <fieldset className={styles.field}>
        <legend>Colour</legend>
        <div className={styles.colors}>
          {SKILL_COLORS.map((option) => {
            const owner = look.usedColors.has(option) ? look.ownerOf(`color:${option}`) : undefined;
            const label = owner ? `${COLOR_NAMES[option]}, used by ${owner}` : COLOR_NAMES[option];
            return (
              <label
                key={option}
                className={styles.swatch}
                data-color={option}
                data-used={owner !== undefined || undefined}
                title={label}
              >
                <input
                  type="radio"
                  name={`${id}-color`}
                  className="visually-hidden"
                  checked={color === option}
                  onChange={() => look.setColor(option)}
                />
                <span className="visually-hidden">{label}</span>
              </label>
            );
          })}
          <label
            className={`${styles.swatch} ${styles.custom}`}
            data-active={custom || undefined}
            title="Your own colour"
          >
            <input
              type="color"
              className={styles.colorInput}
              value={custom ? color : '#3a7bd5'}
              onChange={(event) => {
                const hex = normalizeHex(event.target.value);
                if (hex) look.setColor(hex);
              }}
            />
            <span className="visually-hidden">Your own colour</span>
          </label>
        </div>
        <p className={styles.hint}>
          {colorOwner
            ? `${custom ? 'This colour' : COLOR_NAMES[color as keyof typeof COLOR_NAMES]} is also used by ${colorOwner}.`
            : custom
              ? `Your own colour, ${color}.`
              : `${COLOR_NAMES[color as keyof typeof COLOR_NAMES]}, not used anywhere else.`}
        </p>
      </fieldset>
    </div>
  );
}
