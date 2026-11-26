// Still pictures of the monster pike fight on the lake preview page
// (tools/preview/lake.mjs), one at each moment of the fight, for judging how
// it looks in a session that cannot watch it move. The test bot plays; the
// game is held still while each picture is taken.
//
//   npx vite preview --outDir <page folder> --port 4180   (in another shell)
//   node tools/preview/pike-stills.mjs <out folder> [difficulty] [hero] [quality]
//
// Each picture is <out folder>/<difficulty>-<hero>-<moment>.png. It prints
// what the rules and the drawing had at each moment.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [out, difficulty = 'normal', hero = 'Yaarbro', quality = 'low'] = process.argv.slice(2);
if (!out) {
  console.error('Usage: node tools/preview/pike-stills.mjs <out folder> [difficulty] [hero] [quality]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on('pageerror', (error) => console.log(`error: ${error.message}`));
await page.goto(`http://localhost:4180/?quality=${quality}#place=pike&difficulty=${difficulty}&hero=${hero}&mode=watch`);
await page.waitForFunction(() => window.__grove?.ready && window.__grove.mode === 'playing', null, { timeout: 300_000 });
await page.addStyleTag({ content: '#preview-panel{display:none}' });
// A moment is a phase of the pike (or a thrash on the line) and how many seconds into it.
const moments = [['hooked', 2.5], ['thrash', 0.4], ['dragging', 0.5], ['circling', 1.2], ['charge', 0.2], ['gape', 0.4], ['snap', 0.1], ['rest', 0.5], ['stagger', 0.3], ['beaten', 1.2], ['beaten', 9]];
for (const [phase, after] of moments) {
  await page.evaluate(() => (window.__previewHold = false));
  const reached = await page
    .waitForFunction(
      ([wanted, seconds]) => {
        const { game } = window.__grove;
        if (game.complete) return 'over';
        if (wanted === 'thrash') return game.fishing.phase === 'hooked' && game.fishing.fight === 'thrash';
        return game.pike.phase === wanted && game.pike.timer >= seconds;
      },
      [phase, after],
      { timeout: 900_000, polling: 'raf' },
    )
    .then((value) => value.jsonValue())
    .catch(() => 'never');
  await page.evaluate(() => (window.__previewHold = true));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const doing = await page.evaluate(() => {
    const { game, pike } = window.__grove;
    return `${game.seconds.toFixed(1)} s, hero ${game.swimming ? 'swimming' : `on ${game.groundId}`}, hearts lost ${game.heartsLost}, pike ${JSON.stringify(pike)}`;
  });
  if (reached === true) await page.screenshot({ path: join(out, `${difficulty}-${hero}-${phase}-${after}.png`) });
  console.log(`${phase} ${after}: ${reached === true ? doing : `not reached (${reached})`}`);
}
await browser.close();
