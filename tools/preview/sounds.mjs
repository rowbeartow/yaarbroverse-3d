// Builds the sound board: the page the owner listens to every sound and piece
// of music on, before a sound is added to the game or changed.
//
//   node tools/preview/sounds.mjs <folder> [<extras folder>]
//
//   folder          where to put the page. Anything already there is replaced.
//   extras folder   optional: other choices that are not in the game, to
//                   offer beside the picks. It holds the sound files and an
//                   extras.json listing them:
//                   [{ "label", "what", "file", "credit", "loop", "level" }]
//
// The page is made from the game's own list (src/audio/sounds.ts) and plays
// the game's own recipes (src/audio/synth.ts) and files (assets/audio/).
//
// Like the other preview pages, it is made to be published as a private
// Claude artifact: sound files travel as base64 text in .txt files.
//
// To look at it here: `npx vite preview --outDir <folder> --port 4177`, then
// open http://localhost:4177/ .
//
// To publish it (a Claude session does this with its Artifact tool): the page
// is <folder>/index.html, with <folder> as the root, and every file listed in
// <folder>/files.json goes with it at the same path. To replace the page the
// owner already has, pass that page's address (docs/session-handoff.md gives
// it) so his link stays the same.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const [out, extrasFolder] = process.argv.slice(2);
if (!out) {
  console.error('Usage: node tools/preview/sounds.mjs <folder> [<extras folder>]');
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const media = join(out, 'media');
rmSync(out, { recursive: true, force: true });
mkdirSync(media, { recursive: true });
const files = ['sounds.js', 'media/board.json'];

/** One line of source and license for each recorded file, as CREDITS.md has it. */
const og = (title, by) => `Recorded: "${title}" by ${by}, from OpenGameArt. CC0.`;
const CREDIT = [
  [/^step-moss-/, og("Fantozzi's Footsteps (Grass/Sand & Stone)", 'Fantozzi')],
  [/^step-(wood|mushroom)/, og('Different steps on wood, stone, leaves, gravel and mud', 'TinyWorlds')],
  [/^(jump|pounce|marmot-throw)\./, og('Swishes Sound Pack', 'artisticdude')],
  [/^(land|strike)\./, og('Thwack Sounds', 'AntumDeluge')],
  [/^bounce\./, og('Spring Sounds', 'bart')],
  [/^hit\./, og('Punch', 'qubodup')],
  [/^roll\./, og('Bowling Ball Rolling', 'qubodup')],
  [/^(checkpoint|hearts-out)\./, og('Chimey UI Sounds', 'MouseBYTE')],
  [/^fall\./, og('Short wind sound', 'remaxim')],
  [/^marmot-warning\./, og('Squeak Toy Sounds', 'bart')],
  [/^button\./, og('Interface Sounds', 'Kenney')],
  [/^leaf-tune\./, og('Victory Fanfare Short', 'cynicmusic')],
  [/^grove-music/, og('Forest Whisper Theme', 'Cleyton Kauffman')],
];
const credits = {};
for (const file of readdirSync('assets/audio').sort()) {
  writeFileSync(join(media, `${file}.txt`), readFileSync(join('assets/audio', file)).toString('base64'));
  files.push(`media/${file}.txt`);
  credits[file] = CREDIT.find(([pattern]) => pattern.test(file))?.[1] ?? 'See CREDITS.md.';
}
let extras = [];
if (extrasFolder && existsSync(join(extrasFolder, 'extras.json'))) {
  extras = JSON.parse(readFileSync(join(extrasFolder, 'extras.json'), 'utf8'));
  for (const extra of extras) {
    writeFileSync(join(media, `${extra.file}.txt`), readFileSync(join(extrasFolder, extra.file)).toString('base64'));
    files.push(`media/${extra.file}.txt`);
  }
}
writeFileSync(join(media, 'board.json'), `${JSON.stringify({ credits, extras }, null, 2)}\n`);

await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: resolve(out),
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: join(here, 'sounds.ts'), formats: ['es'], fileName: () => 'sounds.js' },
  },
});
copyFileSync(join(here, 'sounds.html'), join(out, 'index.html'));
writeFileSync(join(out, 'files.json'), `${JSON.stringify(files, null, 2)}\n`);
console.log(`The sound board is in ${out}`);
