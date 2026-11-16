// Still pictures of the lake preview page (tools/preview/lake.mjs), for
// judging how a moment looks in a session that cannot watch it move. The game
// is held still at each moment asked for (seconds of game time) while the
// picture is taken.
//
//   npx vite preview --outDir <page folder> --port 4180   (in another shell)
//   node tools/preview/lake-stills.mjs <out folder> <name> "<choice>" <seconds,seconds,...> [quality]
//
//   choice    what the page's panel would pick, as after # in its address:
//             place=crocodiles|ropes, difficulty=easy|normal|hard,
//             hero=Yaarbro|Caputo, mode=watch|play
//   quality   the game's tier (high, medium, low, minimal): medium by default.
//             A machine with no graphics card draws a frame in seconds.
//
// Each picture is <out folder>/<name>-<seconds>.png. It prints what the game
// was doing at each moment.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [out, name, choice, moments, quality = 'medium'] = process.argv.slice(2);
if (!out || !name || choice === undefined || !moments) {
  console.error('Usage: node tools/preview/lake-stills.mjs <out folder> <name> "<choice>" <seconds,...> [quality]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const problems = [];
page.on('pageerror', (error) => problems.push(`error: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});
await page.goto(`http://localhost:4180/?quality=${quality}#${choice}`);
await page.waitForFunction(() => window.__grove?.ready && window.__grove.mode === 'playing', null, { timeout: 300_000 });
for (const at of moments.split(',').map(Number)) {
  await page.evaluate(() => (window.__previewHold = false));
  await page.waitForFunction((t) => window.__grove.game.seconds >= t, at, { timeout: 600_000, polling: 'raf' });
  await page.evaluate(() => (window.__previewHold = true));
  // Two frames drawn while held, so the picture is of this moment.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const doing = await page.evaluate(() => {
    const { game } = window.__grove;
    const off = window.__grove.view?.hanger?.offset; return `${game.seconds.toFixed(2)} s, on ${game.groundId ?? (game.ropeId ? `rope ${game.ropeId}` : game.swimming ? "the water" : "nothing")}${off ? ` (drawn ${off.y.toFixed(2)} m from the rules)` : ""}`;
  });
  await page.screenshot({ path: join(out, `${name}-${at}.png`) });
  console.log(`${at}: ${doing}`);
}
if (problems.length) console.log(problems.slice(0, 10).join('\n'));
await browser.close();
