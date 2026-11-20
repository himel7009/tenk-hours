import { useMemo, useState } from 'react';
import {
  emojiIdeas,
  lookInUse,
  pickColor,
  suggestEmoji,
  type AppearanceKind,
} from '../../domain/appearance';
import type { SkillColor } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';

export interface LookState {
  kind: AppearanceKind;
  icon: string;
  color: SkillColor;
  /** Whether the icon still follows the name, until someone picks one. */
  autoIcon: boolean;
  setIcon: (icon: string) => void;
  setColor: (color: SkillColor) => void;
  /** Unused emoji that fit the name, for the quick row. */
  ideas: string[];
  usedIcons: Set<string>;
  usedColors: Set<SkillColor>;
  /** The name of another item already using this icon or colour. */
  ownerOf: (key: `icon:${string}` | `color:${string}`) => string | undefined;
}

/**
 * The icon and colour of an item being added or edited. A new item gets a
 * colour nothing else uses and an icon that fits its name, and the icon keeps
 * following the name as it is typed until one is picked by hand. An item
 * being edited keeps its own look.
 */
export function useLook({
  kind,
  name,
  current,
  exceptId,
}: {
  kind: AppearanceKind;
  name: string;
  /** The saved look of the item being edited. Omit for a new item. */
  current?: { icon: string; color: SkillColor };
  exceptId?: string;
}): LookState {
  const skills = useTrackerStore((state) => state.skills);
  const domains = useTrackerStore((state) => state.domains);
  const badHabits = useTrackerStore((state) => state.badHabits);
  const moneySections = useTrackerStore((state) => state.moneySections);
  const used = useMemo(
    () => lookInUse([skills, domains, badHabits, moneySections], exceptId),
    [skills, domains, badHabits, moneySections, exceptId],
  );

  const [pickedIcon, setPickedIcon] = useState<string | null>(current?.icon ?? null);
  const [color, setColor] = useState<SkillColor>(() => current?.color ?? pickColor(used.colors));

  const icon = pickedIcon ?? suggestEmoji(name, used.icons, kind);
  const ideas = useMemo(() => emojiIdeas(name, used.icons, kind, 9), [name, used.icons, kind]);

  const usedIcons = useMemo(() => new Set(used.icons), [used.icons]);
  const usedColors = useMemo(() => new Set(used.colors), [used.colors]);

  return {
    kind,
    icon,
    color,
    autoIcon: pickedIcon === null,
    setIcon: setPickedIcon,
    setColor,
    ideas,
    usedIcons,
    usedColors,
    ownerOf: (key) => used.owners.get(key),
  };
}
