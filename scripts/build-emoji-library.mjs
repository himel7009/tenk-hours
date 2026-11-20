// Builds src/data/emojiLibrary.json from emojibase-data, the emoji list the
// icon picker searches. Run with `npm run emoji` after updating emojibase-data.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = (path) => JSON.parse(readFileSync(require.resolve(path), 'utf8'));
const emojis = read('emojibase-data/en/compact.json');

// Emoji newer than Emoji 14 (2021) still show as empty boxes on many phones.
const MAX_VERSION = 14;
const version = new Map(read('emojibase-data/en/data.json').map((e) => [e.hexcode, e.version]));

// Group numbers from emojibase-data/meta/groups.json. Skin tone swatches and
// regional letters (group 2, or no group) are left out.
const GROUPS = { 0: 0, 1: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8 };

const rows = emojis
  .filter((e) => e.group !== undefined && e.group in GROUPS)
  .filter((e) => (version.get(e.hexcode) ?? 0) <= MAX_VERSION)
  .sort((a, b) => a.order - b.order)
  .map((e) => [e.unicode, GROUPS[e.group], e.label, (e.tags ?? []).join(' ').toLowerCase()]);

writeFileSync(
  new URL('../src/data/emojiLibrary.json', import.meta.url),
  JSON.stringify(rows) + '\n',
);
console.log(`${rows.length} emoji written`);
