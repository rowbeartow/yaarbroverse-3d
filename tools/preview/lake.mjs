// Builds the lake preview page: the game itself (its scenery, light, camera,
// heroes, sounds and rules), opening on Cocolalla Lake at the crocodile
// stepping stones or the rope swings, on the difficulty and hero picked on
// the page, with the test bot playing ("Watch") or you ("Play it yourself").
// The owner looks at a change to the lake's pieces on it before it merges.
//
//   npm run assets
//   node tools/preview/lake.mjs <folder>
//
//   folder   where to put the page. Anything already there is replaced.
//
// The page opens on the crocodiles, on Normal, as Yaarbro, watching. Its own
// part is tools/preview/lake-preview.ts; the rest is src/ as it is now.
//
// Like the other preview pages, it is made to be published as a private
// Claude artifact, which takes only the web's own kinds of file: the models,
// textures, the forest light and the picture decoder travel as base64 text
// (<file>.txt), and a few lines at the top of the page fetch those in their
// place. The page is <folder>/index.html, with <folder> as the root, and every
// file listed in <folder>/files.json goes with it at the same path.
//
// To look at it here: `npx vite preview --outDir <folder> --port 4180`, then
// open http://localhost:4180/ (add #difficulty=hard&place=ropes and so on).

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { build } from 'vite';

const [out] = process.argv.slice(2);
if (!out) {
  console.error('Usage: node tools/preview/lake.mjs <folder>');
  process.exit(1);
}
const folder = resolve(out);
rmSync(folder, { recursive: true, force: true });
mkdirSync(folder, { recursive: true });

// The game's own page, with the preview's part in place of the game's start.
const entry = 'preview-lake.html';
const page = readFileSync('index.html', 'utf8').replace('<script type="module" src="./src/main.ts"></script>', '<script type="module" src="./tools/preview/lake-preview.ts"></script>');
if (!page.includes('lake-preview.ts')) throw new Error("index.html no longer starts the game the way this script expects: look for its <script> tag");
writeFileSync(entry, page);
try {
  await build({ logLevel: 'warn', build: { outDir: folder, emptyOutDir: true, rollupOptions: { input: entry } } });
} finally {
  rmSync(entry, { force: true });
}

// Files a Claude artifact will not carry as they are: sent as base64 text instead.
const WRAPPED = ['.glb', '.ktx2', '.hdr', '.wasm', '.bin'];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(folder);
const listed = [];
for (const path of files) {
  const name = relative(folder, path);
  if (name === entry) continue;
  if (WRAPPED.some((ending) => name.endsWith(ending))) {
    writeFileSync(`${path}.txt`, readFileSync(path).toString('base64'));
    rmSync(path);
    listed.push(`${name}.txt`);
  } else listed.push(name);
}

// The page: fetch the wrapped files from their .txt, before anything else runs.
const shim = `<script>
(() => {
  const wrapped = ${JSON.stringify(WRAPPED)};
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, location.href);
    if (path.origin === location.origin && wrapped.some((ending) => path.pathname.endsWith(ending))) {
      path.pathname += '.txt';
      const response = await real(path.href, init);
      if (!response.ok) return response;
      const text = (await response.text()).trim();
      const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
      const type = path.pathname.includes('.wasm') ? 'application/wasm' : 'application/octet-stream';
      return new Response(bytes, { status: 200, headers: { 'Content-Type': type } });
    }
    return real(input, init);
  };
})();
</script>`;
const built = readFileSync(join(folder, entry), 'utf8')
  .replace('<head>', `<head>\n${shim}`)
  .replace(/<title>[^<]*<\/title>/, '<title>Lake preview</title>');
writeFileSync(join(folder, 'index.html'), built);
rmSync(join(folder, entry));
writeFileSync(join(folder, 'files.json'), `${JSON.stringify(listed.filter((name) => name !== 'index.html').sort(), null, 2)}\n`);
const bytes = listed.reduce((sum, name) => sum + statSync(join(folder, name)).size, 0);
console.log(`The lake preview is in ${out}: ${listed.length} files, ${(bytes / 1e6).toFixed(1)} MB`);
