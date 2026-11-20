import { describe, expect, it } from 'vitest';
import {
  emojiForName,
  emojiIdeas,
  firstEmoji,
  lookInUse,
  normalizeHex,
  pickColor,
  planLookFixes,
  suggestEmoji,
} from './appearance';
import { SKILL_COLORS, isSkillColor, type SkillColor } from './types';

describe('pickColor', () => {
  it('starts with the first colour', () => {
    expect(pickColor([])).toBe('cobalt');
  });

  it('gives twelve items twelve different colours', () => {
    const used: SkillColor[] = [];
    for (let i = 0; i < SKILL_COLORS.length; i++) used.push(pickColor(used));
    expect(new Set(used).size).toBe(SKILL_COLORS.length);
  });

  it('then repeats the least used colour', () => {
    const used: SkillColor[] = [...SKILL_COLORS, 'cobalt'];
    expect(pickColor(used)).toBe('persimmon');
  });

  it('fills a gap left by a deleted item', () => {
    const used = SKILL_COLORS.filter((color) => color !== 'teal');
    expect(pickColor(used)).toBe('teal');
  });

  it('does not count custom colours', () => {
    expect(pickColor(['#123456'])).toBe('cobalt');
  });
});

describe('suggestEmoji', () => {
  it('fits the name', () => {
    expect(suggestEmoji('Python', [], 'skill')).toBe('🐍');
    expect(suggestEmoji('Competitive programming', [], 'skill')).toBe('🏆');
    expect(suggestEmoji('Running', [], 'habit')).toBe('🏃');
    expect(suggestEmoji('Doomscrolling', [], 'badHabit')).toBe('🚫');
    expect(suggestEmoji('Meal', [], 'section')).toBe('🍚');
    expect(suggestEmoji('Mathematics', [], 'domain')).toBe('🧮');
  });

  it('skips emoji already in use', () => {
    expect(suggestEmoji('Python', ['🐍'], 'skill')).toBe('💻');
    expect(suggestEmoji('Python', ['🐍', '💻'], 'skill')).toBe('🎯');
  });

  it('falls back on the kind when no word matches', () => {
    expect(suggestEmoji('Zorblax', [], 'habit')).toBe('🌱');
    expect(suggestEmoji('Zorblax', [], 'project')).toBe('🛠️');
  });

  it('matches short words only as whole words', () => {
    expect(emojiForName('Categories')).not.toContain('🐈');
    expect(emojiForName('AI')).toContain('🤖');
    expect(emojiForName('Fairy tales')).not.toContain('🤖');
  });

  it('offers unused ideas', () => {
    const ideas = emojiIdeas('Guitar', ['🎸'], 'skill', 5);
    expect(ideas).toHaveLength(5);
    expect(ideas).not.toContain('🎸');
  });
});

describe('lookInUse', () => {
  it('collects everything but the item being edited', () => {
    const skills = [
      { id: 'a', name: 'Python', icon: '🐍', color: 'cobalt' as const },
      { id: 'b', name: 'Guitar', icon: '🎸', color: 'moss' as const },
    ];
    const domains = [{ id: 'c', name: 'AI', icon: '🤖', color: 'plum' as const }];
    const look = lookInUse([skills, domains], 'b');
    expect(look.icons).toEqual(['🐍', '🤖']);
    expect(look.colors).toEqual(['cobalt', 'plum']);
    expect(look.owners.get('icon:🐍')).toBe('Python');
  });
});

describe('planLookFixes', () => {
  it('changes only the later of two items that look the same', () => {
    const skills = [
      { id: 'a', name: 'Python', icon: '🎯', color: 'cobalt' as const },
      { id: 'b', name: 'Guitar', icon: '🎯', color: 'cobalt' as const },
      { id: 'c', name: 'Chess', icon: '♟️', color: 'moss' as const },
    ];
    expect(planLookFixes([skills], ['skill'])).toEqual([
      { id: 'b', collection: 0, icon: '🎸', color: 'persimmon' },
    ]);
  });

  it('compares across collections', () => {
    const skills = [{ id: 'a', name: 'Python', icon: '🐍', color: 'cobalt' as const }];
    const sections = [{ id: 's', name: 'Fund', icon: '🐍', color: 'cobalt' as const }];
    const [fix] = planLookFixes([skills, sections], ['skill', 'section']);
    expect(fix).toMatchObject({ id: 's', collection: 1, icon: '🏦', color: 'persimmon' });
  });
});

describe('colours', () => {
  it('accepts names and lowercase hex codes only', () => {
    expect(isSkillColor('fuchsia')).toBe(true);
    expect(isSkillColor('#1f8a70')).toBe(true);
    expect(isSkillColor('#1F8A70')).toBe(false);
    expect(isSkillColor("red'] body {")).toBe(false);
    expect(normalizeHex(' #1F8A70 ')).toBe('#1f8a70');
    expect(normalizeHex('blue')).toBeNull();
  });
});

describe('firstEmoji', () => {
  it('takes the first emoji, keeping joined ones whole', () => {
    expect(firstEmoji(' 🧑‍💻 and more')).toBe('🧑‍💻');
    expect(firstEmoji('🇧🇩')).toBe('🇧🇩');
    expect(firstEmoji('abc')).toBeNull();
    expect(firstEmoji('')).toBeNull();
  });
});
