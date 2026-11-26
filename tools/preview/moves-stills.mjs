// Still pictures of the moves preview page (tools/preview/moves.mjs), for
// judging the heroes' second move in a session that cannot watch it move. The
// move is over in half a second, so the page's clock is slowed to one step of
// the rules for each frame drawn, and the game is held still at each moment
// asked for while the picture is taken.
//
//   npx vite preview --outDir <page folder> --port 4181   (in another shell)
//   node tools/preview/moves-stills.mjs <out folder> <name> "<choice>" <moment,moment,...> [quality]
//
//   choice    what the page's panel would pick, as after # in its address:
//             place=scout|chief, hero=Yaarbro|Caputo, difficulty=easy|normal|hard
//   moment    a phase of the move and seconds into it: windup@0.1, out@0.05,
//             back@0.1, ready@0.2 (ready counts from the moment it is back).
//             They are taken in the order given, each the next time it comes.
//   quality   the game's tier (high, medium, low, minimal): medium by default.
//
// Each picture is <out folder>/<name>-<moment>.png. PORT is where the page is
// served (4181 unless given).

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [out, name, choice, moments, quality = 'medium'] = process.argv.slice(2);
if (!out || !name || choice === undefined || !moments) {
  console.error('Usage: node tools/preview/moves-stills.mjs <out folder> <name> "<choice>" <phase@seconds,...> [quality]');
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
// One step of the rules for each frame drawn, however long the frame takes to draw.
await page.addInitScript(() => {
  const real = window.requestAnimationFrame.bind(window);
  let clock = null;
  window.requestAnimationFrame = (callback) =>
    real(() => {
      clock = clock === null ? performance.now() : clock + 1000 / 60;
      callback(clock);
    });
});
await page.goto(`http://localhost:${process.env.PORT ?? 4181}/?quality=${quality}#${choice}`);
await page.waitForFunction(() => window.__grove?.ready && window.__grove.mode === 'playing', null, { timeout: 300_000 });
for (const moment of moments.split(',')) {
  const [phase, seconds] = moment.split('@');
  await page.evaluate(() => (window.__previewHold = false));
  await page.waitForFunction(
    ([wanted, at]) => {
      const ally = window.__grove.game.sidekick;
      if (!ally || ally.phase !== wanted || ally.timer < at) return false;
      window.__previewHold = true;
      return true;
    },
    [phase, Number(seconds)],
    { timeout: 600_000, polling: 'raf' },
  );
  // Two frames drawn while held, so the picture is of this moment.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const doing = await page.evaluate(() => {
    const { game, sidekick } = window.__grove;
    const ally = game.sidekick;
    return `${game.seconds.toFixed(2)} s: ${ally.phase} for ${ally.timer.toFixed(2)} s, drawn ${JSON.stringify(sidekick)}`;
  });
  await page.screenshot({ path: join(out, `${name}-${moment}.png`), timeout: 300_000 });
  console.log(`${moment}: ${doing}`);
}
if (problems.length) console.log(problems.slice(0, 10).join('\n'));
await browser.close();
