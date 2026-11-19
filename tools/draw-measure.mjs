// Counts what the game draws in a frame at places along a level: draw calls
// and triangles, on the high tier, the way the frame counter (?fps) reports
// them. A machine with no graphics card cannot measure frames a second, but
// it draws the same triangles a Mac does, so this is how a change's cost or
// saving is counted before the owner checks the frame rate.
//
//   npm run build && npx vite preview --port 4173   (in another shell)
//   node tools/draw-measure.mjs [level] [difficulty] [hero]
//
// PORT is where the game is served (4173 unless given), QUALITY the tier
// (high unless given). It stands the hero on
// every safe place of the level in turn, on any other piece of the route more
// than 18 m from the last (never one that moves), and half way across every pool on the route, lets the game draw a
// few frames, and prints a table, with how many enemies were drawn at each.

import { chromium } from 'playwright';

const [level = 'cocolalla', difficulty = 'hard', hero = 'Yaarbro'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.on('pageerror', (error) => console.error(`Page error: ${error.message}`));
const quality = process.env.QUALITY ?? 'high';
await page.goto(`http://localhost:${process.env.PORT ?? 4173}/?quality=${quality}&level=${level}`);
await page.locator('#who-name').fill('Pip');
await page.locator('#who-done').click({ timeout: 300_000, noWaitAfter: true });
await page.locator('#play').waitFor({ state: 'visible' });
await page.waitForFunction(() => window.__grove.ready, null, { timeout: 300_000 });
await page.locator(`[data-hero="${hero}"]`).click({ timeout: 300_000, noWaitAfter: true });
await page.locator(`[data-difficulty="${difficulty}"]`).click({ timeout: 300_000, noWaitAfter: true });
await page.locator(`[data-difficulty="${difficulty}"][aria-checked="true"]`).waitFor({ timeout: 300_000 });
await page.locator('#play').click({ timeout: 300_000, noWaitAfter: true });
await page.waitForFunction(() => window.__grove.mode === 'playing', null, { timeout: 300_000 });
if ((await page.evaluate(() => window.__grove.level)) !== level) throw new Error(`The game is not on ${level}`);
const playing = await page.evaluate(() => window.__grove.game.difficulty);
if (playing !== difficulty) throw new Error(`The game is on ${playing}, not ${difficulty}`);

const places = await page.evaluate(() => {
  const { level } = window.__grove.game;
  const solid = (id) => level.solids.find((s) => s.id === id);
  const out = [];
  level.route.forEach((id, index) => {
    const s = solid(id);
    const last = out[out.length - 1];
    if (s && !s.motion && (s.safe || !last || Math.hypot(s.x - last.x, s.z - last.z) > 18)) out.push({ name: id, x: s.x, y: s.top, z: s.z, dry: true });
    const pool = (level.water ?? []).find((w) => w.id === id);
    const before = solid(level.route[index - 1]);
    const after = solid(level.route[index + 1]);
    if (pool && before && after) out.push({ name: `${id} (mid swim)`, x: (before.x + after.x) / 2, y: pool.surface - 0.5, z: (before.z + after.z) / 2 });
  });
  return out;
});
console.log(`${level}, ${difficulty}, ${hero}, ${quality} tier`);
console.log('| Place | Draw calls | Triangles | Enemies drawn |');
console.log('| --- | --- | --- | --- |');
let most = 0;
for (const place of places) {
  const frame = await page.evaluate(
    (at) =>
      new Promise((done) => {
        const worst = { drawCalls: 0, triangles: 0, enemies: 0 };
        let left = 20;
        const next = () => {
          const { game } = window.__grove;
          // Held in place, and never hurt, so every frame is drawn from the same spot.
          Object.assign(game, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, hearts: 9 });
          // Moved here from the water, the hero is on dry ground again: without this the game goes on as if it swam, and its enemies stand still.
          if (at.dry) Object.assign(game, { swimming: false, under: false, waterId: null, climbing: 0, grounded: true, stunned: 0, returning: 0, fainting: 0 });
          const { drawCalls, triangles } = window.__grove.stats;
          if (left < 6 && triangles > worst.triangles) Object.assign(worst, { drawCalls, triangles, enemies: window.__grove.enemies.filter((e) => e.visible).length });
          left -= 1;
          if (left > 0) requestAnimationFrame(next);
          else done(worst);
        };
        requestAnimationFrame(next);
      }),
    place,
  );
  most = Math.max(most, frame.triangles);
  console.log(`| ${place.name} | ${frame.drawCalls} | ${frame.triangles.toLocaleString('en')} | ${frame.enemies} |`);
}
console.log(`Most triangles in a frame: ${most.toLocaleString('en')}`);
await browser.close();
