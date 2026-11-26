// Still pictures of the new moves (Walblum's kick, Claw Slash) on the lake
// preview page (tools/preview/lake.mjs), from the game's own camera, for
// judging them in a session that cannot watch them move. The game is held
// still while each picture is taken.
//
//   npx vite preview --outDir <page folder> --port 4180   (in another shell)
//   node tools/preview/moves-stills.mjs <out folder> [hero] [quality]
//
// Each picture is <out folder>/<hero>-<moment>.png: the hero's own clip just
// after the button is pressed, the flight out, the strike, and the way back.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [out, hero = 'Yaarbro', quality = 'low'] = process.argv.slice(2);
if (!out) {
  console.error('Usage: node tools/preview/moves-stills.mjs <out folder> [hero] [quality]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on('pageerror', (error) => console.log(`error: ${error.message}`));
await page.goto(`http://localhost:4180/?quality=${quality}#place=moves&difficulty=hard&hero=${hero}&mode=watch`);
await page.waitForFunction(() => window.__grove?.ready && window.__grove.mode === 'playing', null, { timeout: 300_000 });
await page.addStyleTag({ content: '#preview-panel{display:none}' });
// Each moment: a phase of the button, and whether a strike's burst is showing.
const moments = [['out', false], ['back', true], ['back', false], ['rest', false], ['out', false], ['back', true]];
for (const [index, [phase, burst]] of moments.entries()) {
  await page.evaluate(() => (window.__previewHold = false));
  await page.waitForFunction(([wanted, withBurst]) => window.__grove.ability?.phase === wanted && (!withBurst || window.__grove.ability.burst), [phase, burst], { timeout: 300_000, polling: 'raf' });
  await page.evaluate(() => (window.__previewHold = true));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const doing = await page.evaluate(() => `${window.__grove.game.seconds.toFixed(2)} s, ${JSON.stringify(window.__grove.ability)}, hero clip ${JSON.stringify(window.__grove.hero?.clips ?? window.__grove.hero)}`.slice(0, 400));
  await page.screenshot({ path: join(out, `${hero}-${index + 1}-${phase}${burst ? '-strike' : ''}.png`) });
  console.log(`${phase}${burst ? ' strike' : ''}: ${doing}`);
}
await browser.close();
