// Takes still frames of the arena preview page (see arena.mjs) and lays them
// out on one sheet, for checking it in a session that cannot watch it move.
//
//   node tools/preview/arena-stills.mjs <sheet.jpg> <place> <difficulty> <seconds,seconds,...> [hero] [play]
//
//   place        a place on the page: clearing, boughs, climb (the PLACES table in arena.ts)
//   difficulty   easy, normal or hard
//   seconds      how far into the script each frame is taken, with commas between
//
// Serve the page first: `npx vite preview --outDir <folder> --port 4179`.
// The page is drawn in flat light, because a cloud session has no graphics
// card, and is run forward in the game's own fixed steps, not by the clock.

import { chromium } from 'playwright';
import sharp from 'sharp';

const [out, place, difficulty, times, hero = 'Yaarbro'] = process.argv.slice(2);
if (!out || !place || !difficulty || !times) {
  console.error('Usage: node tools/preview/arena-stills.mjs <sheet.jpg> <place> <difficulty> <seconds,seconds,...> [hero]');
  process.exit(1);
}
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.error(`Page error: ${error.message}`));
page.on('console', (message) => message.type() === 'error' && console.error(`Console: ${message.text()}`));
await page.goto(`http://localhost:4179/?plain&still&place=${place}&difficulty=${difficulty}&hero=${hero}`);
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 180000 });
const shot = page.locator('.window');
await shot.scrollIntoViewIfNeeded();
const tile = { width: 560, height: 350 };
const frames = [];
let at = 0;
for (const until of times.split(',').map(Number)) {
  await page.evaluate((seconds) => window.arena.run(seconds), until - at);
  at = until;
  const words = await page.evaluate(() => `${document.getElementById('doing').textContent} | ${document.getElementById('caption').textContent}`);
  console.log(`${until}s: ${words}`);
  frames.push(await sharp(await shot.screenshot()).resize(tile.width, tile.height).toBuffer());
}
const across = Math.min(frames.length, 3);
const down = Math.ceil(frames.length / across);
await sharp({ create: { width: across * tile.width, height: down * tile.height, channels: 3, background: '#14261f' } })
  .composite(frames.map((input, i) => ({ input, left: (i % across) * tile.width, top: Math.floor(i / across) * tile.height })))
  .jpeg({ quality: 86 })
  .toFile(out);
await browser.close();
console.log(`Wrote ${out}`);
