import { SKILL_COLORS, isCustomColor, type NamedColor, type SkillColor } from './types';

/**
 * Automatic colours and icons. Everything with a colour and an icon (skills,
 * habits, projects, domains, bad habits and money sections) shares one pool,
 * so a new item gets a colour and an emoji nothing else is using yet.
 */

export type AppearanceKind = 'skill' | 'habit' | 'project' | 'domain' | 'badHabit' | 'section';

export interface Look {
  icon: string;
  color: SkillColor;
}

/**
 * The named colour fewest items use, earliest in the palette on a tie, so
 * the first twelve items all differ and after that colours repeat evenly.
 * Custom colours do not use up a named one.
 */
export function pickColor(used: readonly SkillColor[]): NamedColor {
  const counts = new Map<NamedColor, number>(SKILL_COLORS.map((color) => [color, 0]));
  for (const color of used) {
    if (!isCustomColor(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best: NamedColor = SKILL_COLORS[0];
  for (const color of SKILL_COLORS) {
    if (counts.get(color)! < counts.get(best)!) best = color;
  }
  return best;
}

/**
 * Words in a name and the emoji that fit them, best first. A word matches
 * when a word of the name starts with it, so "program" covers programming.
 */
const KEYWORDS: [words: string[], emoji: string[]][] = [
  // Computing
  [['python'], ['🐍', '💻']],
  [
    ['competitive', 'leetcode', 'codeforces', 'contest', 'olympiad', 'icpc'],
    ['🏆', '⚔️', '🥇'],
  ],
  [
    ['javascript', 'typescript', 'react', 'web', 'frontend', 'html', 'css'],
    ['🌐', '⚛️', '💻', '🕸️'],
  ],
  [
    ['program', 'coding', 'code', 'software', 'develop', 'java', 'rust', 'golang', 'c++', 'cpp'],
    ['💻', '⌨️', '🧑‍💻', '🖥️'],
  ],
  [
    ['algorithm', 'dsa', 'data structure', 'problem', 'puzzle'],
    ['🧩', '🔢', '🧠'],
  ],
  [
    ['ai', 'artificial', 'intelligence', 'llm', 'gpt', 'agent'],
    ['🤖', '🧠', '✨'],
  ],
  [
    ['machine', 'ml', 'learning model'],
    ['🤖', '⚙️', '📈'],
  ],
  [
    ['deep', 'neural', 'network'],
    ['🧠', '🕸️', '🔮'],
  ],
  [
    ['data', 'analytics', 'statistic', 'sql', 'database', 'excel'],
    ['📊', '📈', '🗄️'],
  ],
  [
    ['vision', 'image', 'opencv'],
    ['👁️', '🖼️'],
  ],
  [
    ['security', 'cyber', 'hacking', 'crypto'],
    ['🔐', '🛡️', '🕵️'],
  ],
  [
    ['linux', 'devops', 'cloud', 'server', 'docker', 'kubernetes', 'backend'],
    ['🐧', '☁️', '🐳', '🛠️'],
  ],
  [
    ['app', 'android', 'ios', 'mobile', 'flutter'],
    ['📱', '📲'],
  ],
  [
    ['game dev', 'unity', 'unreal', 'gamedev'],
    ['🕹️', '👾'],
  ],
  [
    ['robot', 'arduino', 'electronic', 'circuit', 'embedded'],
    ['🦾', '🔌', '🔧'],
  ],
  [
    ['blockchain', 'web3'],
    ['⛓️', '🪙'],
  ],
  [
    ['design', 'ui', 'ux', 'figma'],
    ['🎨', '📐', '🖌️'],
  ],
  [
    ['startup', 'business', 'entrepreneur', 'company'],
    ['🚀', '💼', '🏢'],
  ],
  [
    ['thesis', 'research', 'paper', 'phd'],
    ['🎓', '📑', '🔬'],
  ],
  [
    ['portfolio', 'website', 'blog'],
    ['🗂️', '🌐', '📝'],
  ],
  // Sciences and study
  [
    ['math', 'calculus', 'algebra', 'geometry', 'linear', 'probability', 'discrete'],
    ['🧮', '➗', '📐', '♾️'],
  ],
  [
    ['physics', 'quantum', 'mechanic'],
    ['⚛️', '🧲', '🔭'],
  ],
  [
    ['chemistry', 'chem', 'lab'],
    ['🧪', '⚗️'],
  ],
  [
    ['biology', 'bio', 'gene', 'cell'],
    ['🧬', '🦠', '🔬'],
  ],
  [
    ['medicine', 'medical', 'anatomy', 'nursing', 'doctor', 'health'],
    ['🩺', '⚕️', '💊'],
  ],
  [
    ['astronomy', 'space', 'astro', 'planet'],
    ['🔭', '🪐', '🌌'],
  ],
  [['engineer'], ['⚙️', '🏗️', '🔩']],
  [
    ['economic', 'finance', 'invest', 'stock', 'trading', 'account'],
    ['💹', '💰', '📉'],
  ],
  [['history'], ['🏛️', '📜']],
  [
    ['philosophy', 'ethics', 'logic'],
    ['🤔', '🏛️'],
  ],
  [
    ['psychology', 'mind'],
    ['🧠', '💭'],
  ],
  [
    ['law', 'legal'],
    ['⚖️', '📜'],
  ],
  [
    ['geography', 'map'],
    ['🗺️', '🌍'],
  ],
  [
    [
      'exam',
      'study',
      'school',
      'university',
      'class',
      'course',
      'lecture',
      'ielts',
      'gre',
      'sat',
      'bcs',
    ],
    ['🎓', '📚', '📝', '🏫'],
  ],
  [
    ['read', 'book', 'novel', 'library'],
    ['📚', '📖', '📕'],
  ],
  [
    ['writ', 'journal', 'essay', 'poem', 'poetry', 'story', 'diary'],
    ['✍️', '📓', '🖋️', '📝'],
  ],
  [
    [
      'language',
      'english',
      'spanish',
      'french',
      'german',
      'japanese',
      'chinese',
      'korean',
      'arabic',
      'bangla',
      'bengali',
      'hindi',
      'vocabulary',
      'grammar',
    ],
    ['🗣️', '🌍', '🔤', '💬'],
  ],
  [
    ['speak', 'public speaking', 'speech', 'debate', 'present'],
    ['🎤', '🗣️'],
  ],
  [
    [
      'quran',
      'prayer',
      'pray',
      'namaz',
      'salah',
      'faith',
      'bible',
      'church',
      'mosque',
      'spiritual',
    ],
    ['🕌', '🤲', '📿', '🕊️'],
  ],
  // Arts
  [
    ['draw', 'sketch', 'illustrat'],
    ['✏️', '🖍️', '🎨'],
  ],
  [
    ['paint', 'art', 'watercolor', 'watercolour'],
    ['🎨', '🖌️', '🖼️'],
  ],
  [
    ['photo', 'camera'],
    ['📷', '📸'],
  ],
  [
    ['video', 'film', 'edit', 'youtube', 'cinema', 'animation'],
    ['🎬', '🎞️', '📹'],
  ],
  [
    ['music', 'song', 'compose', 'produc'],
    ['🎵', '🎼', '🎧'],
  ],
  [['guitar'], ['🎸']],
  [['piano', 'keyboard'], ['🎹']],
  [['violin', 'cello'], ['🎻']],
  [['drum'], ['🥁']],
  [
    ['sing', 'vocal'],
    ['🎤', '🎙️'],
  ],
  [
    ['flute', 'saxophone', 'trumpet'],
    ['🎷', '🎺'],
  ],
  [
    ['dance', 'ballet'],
    ['💃', '🩰'],
  ],
  [['act', 'theatre', 'theater', 'drama'], ['🎭']],
  [
    ['calligraph', 'handwriting', 'lettering'],
    ['🖋️', '✒️'],
  ],
  [
    ['knit', 'sew', 'craft', 'crochet', 'embroider'],
    ['🧶', '🧵', '🪡'],
  ],
  [
    ['wood', 'carpentry', 'diy'],
    ['🪚', '🔨', '🪵'],
  ],
  [['pottery', 'clay', 'sculpt'], ['🏺']],
  // Body and sport
  [
    ['run', 'jog', 'marathon'],
    ['🏃', '👟'],
  ],
  [
    ['walk', 'step', 'hike', 'trek'],
    ['🚶', '🥾', '⛰️'],
  ],
  [
    [
      'gym',
      'workout',
      'lift',
      'strength',
      'weight',
      'muscle',
      'fitness',
      'exercise',
      'pushup',
      'push-up',
    ],
    ['🏋️', '💪', '🔥'],
  ],
  [
    ['yoga', 'stretch', 'pilates'],
    ['🧘', '🤸'],
  ],
  [
    ['meditat', 'mindful', 'breath', 'calm'],
    ['🧘', '🌬️', '🪷'],
  ],
  [
    ['cycl', 'bike', 'bicycle'],
    ['🚴', '🚲'],
  ],
  [['swim'], ['🏊', '🌊']],
  [['football', 'soccer'], ['⚽']],
  [['cricket'], ['🏏']],
  [['basketball'], ['🏀']],
  [
    ['tennis', 'badminton'],
    ['🎾', '🏸'],
  ],
  [['table tennis', 'ping'], ['🏓']],
  [['chess'], ['♟️']],
  [
    ['boxing', 'martial', 'karate', 'judo', 'mma', 'kung'],
    ['🥊', '🥋'],
  ],
  [['climb', 'boulder'], ['🧗']],
  [['skate'], ['🛹']],
  [['golf'], ['⛳']],
  [['sport'], ['🏅', '⚽']],
  // Daily life
  [
    ['sleep', 'bed', 'nap'],
    ['😴', '🛏️', '🌙'],
  ],
  [
    ['wake', 'early', 'morning', 'alarm'],
    ['⏰', '🌅'],
  ],
  [
    ['water', 'hydrat', 'drink water'],
    ['💧', '🚰'],
  ],
  [
    ['cook', 'recipe', 'bake', 'kitchen'],
    ['🍳', '🧑‍🍳', '🥘'],
  ],
  [
    ['diet', 'eat', 'nutrition', 'healthy', 'salad', 'vegetable', 'fruit'],
    ['🥗', '🍎', '🥦'],
  ],
  [
    ['clean', 'tidy', 'chore', 'laundry', 'house'],
    ['🧹', '🧺', '🏠'],
  ],
  [
    ['plant', 'garden'],
    ['🪴', '🌱', '🌻'],
  ],
  [
    ['pet', 'dog'],
    ['🐕', '🐾'],
  ],
  [['cat'], ['🐈']],
  [
    ['family', 'parent', 'kid', 'child'],
    ['👨‍👩‍👧', '🏡'],
  ],
  [
    ['friend', 'social', 'network'],
    ['🤝', '👥'],
  ],
  [
    ['gratitude', 'thank', 'kind'],
    ['🙏', '💛'],
  ],
  [
    ['plan', 'organis', 'organiz', 'review', 'goal'],
    ['🗓️', '📋', '🎯'],
  ],
  [
    ['focus', 'deep work', 'productiv'],
    ['🎯', '⏳'],
  ],
  [
    ['travel', 'trip'],
    ['✈️', '🧳'],
  ],
  [['drive', 'driving', 'car'], ['🚗']],
  [
    ['volunteer', 'charity'],
    ['🤲', '❤️'],
  ],
  [
    ['job', 'work', 'office', 'career', 'interview', 'resume'],
    ['💼', '🧑‍💼'],
  ],
  [
    ['freelanc', 'client', 'upwork', 'fiverr'],
    ['💼', '🤝', '💸'],
  ],
  [
    ['market', 'seo', 'ads', 'brand'],
    ['📣', '📈'],
  ],
  [
    ['sales', 'sell'],
    ['🤝', '💵'],
  ],
  // Things to stop
  [
    ['scroll', 'social media', 'instagram', 'facebook', 'tiktok', 'reel', 'phone', 'screen'],
    ['📱', '🤳', '📵'],
  ],
  [
    ['smok', 'cigarette', 'vape', 'nicotine'],
    ['🚬', '🚭'],
  ],
  [
    ['alcohol', 'beer', 'wine', 'drink'],
    ['🍺', '🍷'],
  ],
  [
    ['sugar', 'sweet', 'candy', 'dessert', 'snack', 'chocolate'],
    ['🍩', '🍬', '🍫'],
  ],
  [
    ['junk', 'fast food', 'burger', 'pizza', 'fried'],
    ['🍔', '🍟', '🍕'],
  ],
  [['soda', 'cola', 'soft drink'], ['🥤']],
  [
    ['coffee', 'caffeine', 'tea'],
    ['☕', '🍵'],
  ],
  [
    ['gaming', 'game', 'pubg', 'fortnite'],
    ['🎮', '🕹️'],
  ],
  [
    ['tv', 'netflix', 'series', 'binge', 'anime', 'youtube'],
    ['📺', '🍿'],
  ],
  [
    ['shopping', 'impulse', 'spend'],
    ['🛒', '🛍️'],
  ],
  [
    ['procrastinat', 'late', 'delay'],
    ['⏰', '🐌'],
  ],
  [['nail', 'bite'], ['💅']],
  [
    ['swear', 'anger', 'angry', 'shout', 'gossip'],
    ['🗯️', '🤐'],
  ],
  [['porn', 'nsfw'], ['🚫']],
  // Money
  [
    ['meal', 'food', 'bazar', 'bazaar', 'grocer', 'lunch', 'dinner', 'breakfast'],
    ['🍚', '🍱', '🛒'],
  ],
  [
    ['fund', 'saving', 'emergency', 'bank', 'deposit'],
    ['🏦', '🐷', '💰'],
  ],
  [
    ['personal', 'pocket', 'daily', 'expense', 'allowance'],
    ['👛', '💳', '👤'],
  ],
  [
    ['rent', 'home', 'flat', 'apartment'],
    ['🏠', '🔑'],
  ],
  [
    ['transport', 'bus', 'rickshaw', 'uber', 'fuel', 'fare', 'metro'],
    ['🚌', '🛺', '⛽'],
  ],
  [
    ['bill', 'utility', 'electric', 'internet', 'gas', 'mobile recharge'],
    ['🧾', '💡', '📶'],
  ],
  [
    ['education', 'tuition', 'fee'],
    ['🎓', '📚'],
  ],
  [
    ['gift', 'eid', 'festival', 'birthday'],
    ['🎁', '🎉'],
  ],
  [
    ['medical', 'pharmacy'],
    ['💊', '🏥'],
  ],
  [
    ['cloth', 'fashion'],
    ['👕', '👗'],
  ],
  [
    ['salary', 'income', 'earning'],
    ['💵', '💰'],
  ],
];

/** Emoji to fall back on when no word matches, chosen to suit each kind. */
const POOLS: Record<AppearanceKind, string[]> = {
  skill: [
    '🎯',
    '🧠',
    '💡',
    '🔭',
    '🧩',
    '🛠️',
    '🚀',
    '📘',
    '🔬',
    '🧭',
    '🏹',
    '🪄',
    '🔑',
    '⚡',
    '🌟',
    '🦉',
  ],
  habit: [
    '🌱',
    '🌿',
    '☀️',
    '🌊',
    '🍃',
    '🌸',
    '🌻',
    '🍀',
    '🌈',
    '🪴',
    '🌞',
    '🌙',
    '💫',
    '🫧',
    '🐢',
    '🦋',
  ],
  project: [
    '🛠️',
    '🏗️',
    '📦',
    '🧱',
    '🗂️',
    '🚧',
    '📌',
    '🧰',
    '📐',
    '🔧',
    '🪛',
    '🗃️',
    '🏁',
    '🛰️',
    '⚓',
    '🧪',
  ],
  domain: [
    '🧭',
    '🏛️',
    '🌐',
    '🗺️',
    '🏔️',
    '🌳',
    '🪐',
    '💠',
    '🔷',
    '🏰',
    '🌋',
    '🎪',
    '🗻',
    '🏝️',
    '🌌',
    '🧿',
  ],
  badHabit: [
    '🚫',
    '⛔',
    '🛑',
    '🙅',
    '⚠️',
    '🔕',
    '🧯',
    '🚷',
    '❌',
    '🪤',
    '🕳️',
    '🐍',
    '🌪️',
    '🥀',
    '🧊',
    '🔒',
  ],
  section: [
    '💼',
    '👛',
    '💳',
    '🏦',
    '💰',
    '🪙',
    '💵',
    '🧾',
    '📒',
    '🐷',
    '🛍️',
    '🎒',
    '💎',
    '🧧',
    '📮',
    '🗳️',
  ],
};

/** A last pool shared by every kind, used once the kind's own pool is taken. */
const SPARE = [
  '🔶',
  '🟣',
  '🟢',
  '🔵',
  '🟠',
  '🟡',
  '🔴',
  '🟤',
  '⭐',
  '🔺',
  '💎',
  '🎈',
  '🪁',
  '🧸',
  '🎲',
  '🪀',
  '🦊',
  '🐼',
  '🐙',
  '🦄',
  '🐝',
  '🐳',
  '🦁',
  '🐧',
  '🍉',
  '🍋',
  '🍇',
  '🥝',
  '🌵',
  '🍄',
  '🌴',
  '🌺',
];

function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);
}

/**
 * Long keys match the start of a word ("program" in "programming"). Short ones
 * like "ai", "run" or "cat" match the whole word or a plain ending ("running",
 * "cats"), so "cat" never matches "category".
 */
function matchesWord(word: string, key: string): boolean {
  if (key.length > 3) return word.startsWith(key);
  return word.startsWith(key) && /^(|s|es|ing|ning|ming|ting|ping)$/.test(word.slice(key.length));
}

/** The emoji whose words appear in a name, best match first. */
export function emojiForName(name: string): string[] {
  const text = name.toLowerCase();
  const words = wordsOf(name);
  const found: string[] = [];
  for (const [keys, emoji] of KEYWORDS) {
    const hit = keys.some((key) =>
      key.includes(' ') ? text.includes(key) : words.some((word) => matchesWord(word, key)),
    );
    if (hit) found.push(...emoji);
  }
  return [...new Set(found)];
}

/**
 * An emoji for a new item: the best fit for its name that nothing else uses,
 * else an unused one from the kind's own pool. If everything is taken, the
 * best fit is reused.
 */
export function suggestEmoji(name: string, used: Iterable<string>, kind: AppearanceKind): string {
  const taken = new Set(used);
  const candidates = [...emojiForName(name), ...POOLS[kind], ...SPARE];
  return candidates.find((emoji) => !taken.has(emoji)) ?? candidates[0]!;
}

/** A few more unused ideas for the name, to show beside the picker. */
export function emojiIdeas(
  name: string,
  used: Iterable<string>,
  kind: AppearanceKind,
  count = 8,
): string[] {
  const taken = new Set(used);
  const candidates = [...new Set([...emojiForName(name), ...POOLS[kind], ...SPARE])];
  return candidates.filter((emoji) => !taken.has(emoji)).slice(0, count);
}

interface Owned {
  id: string;
  name: string;
  icon: string;
  color: SkillColor;
}

/** Every colour and icon in use, leaving out the item being edited. */
export function lookInUse(
  collections: readonly (readonly Owned[])[],
  exceptId?: string,
): { colors: SkillColor[]; icons: string[]; owners: Map<string, string> } {
  const colors: SkillColor[] = [];
  const icons: string[] = [];
  // Which item first used each colour or icon, for "Also used by" hints.
  const owners = new Map<string, string>();
  for (const items of collections) {
    for (const item of items) {
      if (item.id === exceptId) continue;
      colors.push(item.color);
      icons.push(item.icon);
      if (!owners.has(`color:${item.color}`)) owners.set(`color:${item.color}`, item.name);
      if (!owners.has(`icon:${item.icon}`)) owners.set(`icon:${item.icon}`, item.name);
    }
  }
  return { colors, icons, owners };
}

export interface LookFix {
  id: string;
  collection: number;
  icon?: string;
  color?: SkillColor;
}

/**
 * Gives every item that repeats an earlier item's icon or colour a new one,
 * keeping the oldest as it is. Collections are checked in the order given.
 * Colours are fixed only while unused named colours remain.
 */
export function planLookFixes(
  collections: readonly (readonly Owned[])[],
  kinds: readonly AppearanceKind[],
): LookFix[] {
  const icons = new Set<string>();
  const colors: SkillColor[] = [];
  const fixes: LookFix[] = [];
  collections.forEach((items, collection) => {
    for (const item of items) {
      const fix: LookFix = { id: item.id, collection };
      if (icons.has(item.icon)) fix.icon = suggestEmoji(item.name, icons, kinds[collection]!);
      const icon = fix.icon ?? item.icon;
      icons.add(icon);

      const free = SKILL_COLORS.filter((color) => !colors.includes(color));
      if (colors.includes(item.color) && free.length > 0) fix.color = pickColor(colors);
      colors.push(fix.color ?? item.color);

      if (fix.icon !== undefined || fix.color !== undefined) fixes.push(fix);
    }
  });
  return fixes;
}

/** A custom colour from the colour input, which gives lowercase #rrggbb. */
export function normalizeHex(value: string): `#${string}` | null {
  const hex = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? (hex as `#${string}`) : null;
}

/** The first emoji in what someone typed or pasted, or null. */
export function firstEmoji(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const [first] = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed);
  const value = first?.segment ?? '';
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value) ? value : null;
}
