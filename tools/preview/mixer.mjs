// Builds the mixer page: the page the owner sets how loud each group of sounds
// is on, by ear, with one slider for each group and a master. It plays the
// game's real sounds (assets/audio/) through the game's real wiring
// (src/audio/graph.ts), starting from the levels in src/audio/sounds.ts.
//
//   node tools/preview/mixer.mjs <folder>
//
//   folder   where to put the page. Anything already there is replaced.
//
// The owner copies a line of settings from the page ("master -10, music -14,
// warnings 0, jumps -6, footsteps -12, menu -14") and sends it back. Those
// numbers go into MIX in src/audio/sounds.ts, in the same order.
//
// To look at it here: `npx vite preview --outDir <folder> --port 4178`, then
// open http://localhost:4178/ . To measure how loud the levels in sounds.ts
// come out, with that page served: `node tools/preview/mix-measure.mjs`.
//
// To publish it (a Claude session does this with its Artifact tool): the page
// is <folder>/index.html, with <folder> as the root, and every file listed in
// <folder>/files.json goes with it at the same path. To replace the page the
// owner already has, pass that page's address (docs/session-handoff.md gives
// it) so his link stays the same. What the page says under "What changed"
// and after is written by hand in mixer.html.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const [out] = process.argv.slice(2);
if (!out) {
  console.error('Usage: node tools/preview/mixer.mjs <folder>');
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const media = join(out, 'media');
rmSync(out, { recursive: true, force: true });
mkdirSync(media, { recursive: true });
const files = ['mixer.js'];
// Sound files travel as base64 text, as on the other preview pages.
for (const file of readdirSync('assets/audio').sort()) {
  writeFileSync(join(media, `${file}.txt`), readFileSync(join('assets/audio', file)).toString('base64'));
  files.push(`media/${file}.txt`);
}

await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: resolve(out),
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: join(here, 'mixer.ts'), formats: ['es'], fileName: () => 'mixer.js' },
  },
});
copyFileSync(join(here, 'mixer.html'), join(out, 'index.html'));
writeFileSync(join(out, 'files.json'), `${JSON.stringify(files, null, 2)}\n`);
console.log(`The mixer page is in ${out}`);
