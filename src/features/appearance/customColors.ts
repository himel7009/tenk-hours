import { isCustomColor, type SkillColor } from '../../domain/types';

/**
 * CSS that lets a custom colour work like a named one: every
 * `data-color="#1f8a70"` element gets `--skill: #1f8a70`. Only values that
 * pass isCustomColor (a strict hex code) are written, so stored text can never
 * break out of the rule.
 */
export function customColorCss(colors: Iterable<SkillColor>): string {
  const hex = [...new Set(colors)].filter(isCustomColor).sort();
  return hex.map((color) => `[data-color='${color}']{--skill:${color}}`).join('\n');
}
