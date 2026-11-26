// The moves preview page's own part: it runs before the game (src/main.ts)
// and asks it, through `window.__grovePreview`, to start the Bouncing Grove
// beside a marmot scout or at the Marmot Chief's door, with the heroes'
// second move switched on (Walblum's karate kick for Yaarbro, the Claw Slash
// for Caputo: src/game/sidekick.ts). "Watch" sends the move at the target
// over and over; "Play it yourself" hands you the controls (C or Z, or the
// new round button on touch).
//
// What is picked is kept in this browser's storage, so it survives the reload
// a new choice needs (an address after # is read first, for the stills
// script). The panel at the top left picks.
//
// Built by tools/preview/moves.mjs. Everything else on the page is the game
// itself: its scenery, its light, its camera, its rules.

import { bossOpen, bossSettled } from '../../src/game/boss';
import type { Difficulty } from '../../src/game/difficulty';
import type { Game, Input } from '../../src/game/game';
import { IDLE } from '../../src/game/game';
import type { HeroName } from '../../src/game/hero';

interface Place {
  id: string;
  label: string;
  /** The solid the hero starts on. */
  at: string;
  /** What the move is sent at: an enemy's id, or the boss. */
  target: string | 'boss';
}

const PLACES: Place[] = [
  { id: 'scout', label: 'At a marmot scout', at: 'bank-2', target: 'scout-clearing' },
  { id: 'chief', label: 'At the Marmot Chief', at: 'bank-6', target: 'boss' },
];
const DIFFICULTIES: [Difficulty, string][] = [
  ['easy', 'Easy'],
  ['normal', 'Normal'],
  ['hard', 'Hard'],
];
const HEROES: HeroName[] = ['Yaarbro', 'Caputo'];

const KEPT = 'moves-preview-choice';
const kept = ((): string => {
  try {
    return window.localStorage.getItem(KEPT) ?? '';
  } catch {
    return '';
  }
})();
const asked = new URLSearchParams(window.location.hash.includes('=') ? window.location.hash.slice(1) : kept);
const place = PLACES.find((each) => each.id === asked.get('place')) ?? PLACES[0];
// Hard by default at the scout (it takes two hits there), Easy at the chief (a hit counts at any time).
const difficulty = (DIFFICULTIES.find(([id]) => id === asked.get('difficulty'))?.[0] ?? (place.id === 'scout' ? 'hard' : 'easy')) as Difficulty;
const hero = HEROES.find((each) => each === asked.get('hero')) ?? 'Yaarbro';
const watching = asked.get('mode') !== 'play';

/** How far off the hero stands to send the move: far enough to watch it fly. */
const STAND_OFF = 7.5;
let playing: Game | null = null;
/** Game time when the target was beaten, or null; and steps since the button was last pressed. */
let beatenAt: number | null = null;
let sincePress = 0;

/** Watching: walk to a few metres from the target, face it, and send the move each time it is back. */
const pilot = (game: Game): Input => {
  if (game !== playing) {
    playing = game;
    beatenAt = null;
    sincePress = 0;
  }
  const enemy = place.target === 'boss' ? null : game.enemies.find((each) => each.spot.id === place.target);
  const boss = place.target === 'boss' ? game.boss : null;
  // The page shows the move, not dodging. The target is kept on watch, so it never gets as far as an attack;
  // a boss on its guard (Normal and Hard) has to attack to give an opening, so there the hero is simply not hurt.
  if (enemy && enemy.phase === 'idle') enemy.timer = 0;
  if (boss && boss.phase === 'idle' && !boss.spot.numbers.guarded) boss.timer = 0;
  if (boss?.spot.numbers.guarded) game.protectedFor = 1;
  const at = enemy ?? boss;
  const ground = game.level.solids.find((each) => each.id === place.at);
  if (!at || !ground) return IDLE;
  const gone = at.phase === 'defeated';
  if (gone && beatenAt === null) beatenAt = game.seconds;
  if (gone) return IDLE;
  sincePress += 1;
  // Where to stand: on this bank, STAND_OFF from the target on the side with the most room, and never near an edge.
  const awayX = ground.x - at.x;
  const awayZ = ground.z + ground.halfZ * 0.5 - at.z;
  const away = Math.hypot(awayX, awayZ) || 1;
  const inset = 1.5;
  const spot = {
    x: Math.max(ground.x - ground.halfX + inset, Math.min(ground.x + ground.halfX - inset, at.x + (awayX / away) * STAND_OFF)),
    z: Math.max(ground.z - ground.halfZ + inset, Math.min(ground.z + ground.halfZ - inset, at.z + (awayZ / away) * STAND_OFF)),
  };
  const toSpot = Math.hypot(spot.x - game.x, spot.z - game.z);
  const dx = at.x - game.x;
  const dz = at.z - game.z;
  const far = Math.hypot(dx, dz) || 1;
  // A boss has to be met first: walk in until the fight is on.
  if (boss && boss.phase === 'waiting') return { ...IDLE, moveX: dx / far, moveZ: dz / far };
  if (toSpot > 1.2 && game.sidekick?.phase === 'ready') return { ...IDLE, moveX: (spot.x - game.x) / toSpot, moveZ: (spot.z - game.z) / toSpot };
  const open = boss ? bossOpen(boss) && bossSettled(boss) : true;
  const facing = Math.atan2(dx, dz);
  const turned = Math.abs(Math.atan2(Math.sin(facing - game.facing), Math.cos(facing - game.facing))) < 0.35;
  // A slow step toward it turns him to face it; then a moment standing, and the press.
  if (!turned) return { ...IDLE, moveX: (dx / far) * 0.2, moveZ: (dz / far) * 0.2 };
  const ready = game.sidekick?.phase === 'ready';
  const press = Boolean(ready && open && sincePress > 50);
  if (press) sincePress = 0;
  return { ...IDLE, ally: press };
};

const page = window as unknown as { __previewHold?: boolean };
(window as unknown as { __grovePreview: unknown }).__grovePreview = {
  level: 'bouncing-grove',
  at: place.at,
  difficulty,
  hero,
  ally: true,
  pilot: watching ? pilot : undefined,
  // Watching, the place starts over a moment after the target is beaten.
  again: (game: Game) => watching && game === playing && beatenAt !== null && game.seconds - beatenAt > 2.2,
  hold: () => page.__previewHold === true,
};

// The panel: place, difficulty, hero, and watch or play. A new choice reloads the page.
const panel = document.createElement('div');
panel.id = 'preview-panel';
panel.innerHTML = `<style>
#preview-panel { position: fixed; top: 64px; left: 8px; z-index: 50; display: flex; flex-direction: column; gap: 6px;
  font: 600 13px/1.2 system-ui, sans-serif; color: #1d2a1f; }
#preview-panel .row { display: flex; gap: 4px; flex-wrap: wrap; }
#preview-panel button { font: inherit; padding: 6px 10px; border-radius: 999px; border: 0; cursor: pointer;
  background: rgba(255,255,255,0.78); color: #1d2a1f; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }
#preview-panel button[aria-pressed="true"] { background: #2f6e4c; color: #fff; }
#preview-panel .note { background: rgba(255,255,255,0.78); padding: 6px 10px; border-radius: 10px; max-width: 22em; font-weight: 500; }
</style>`;
const row = (options: [string, string][], key: string, current: string): void => {
  const holder = document.createElement('div');
  holder.className = 'row';
  for (const [id, label] of options) {
    const button = document.createElement('button');
    button.textContent = label;
    button.setAttribute('aria-pressed', String(id === current));
    button.addEventListener('click', () => {
      const next = new URLSearchParams(asked);
      next.set(key, id);
      // A new place takes its own difficulty unless one is picked after it.
      if (key === 'place') next.delete('difficulty');
      try {
        window.localStorage.setItem(KEPT, next.toString());
      } catch {
        // No storage here: the page opens on its first choice again.
      }
      if (window.location.hash.includes('=')) window.location.hash = next.toString();
      window.location.reload();
    });
    holder.append(button);
  }
  panel.append(holder);
};
row(PLACES.map((each) => [each.id, each.label]), 'place', place.id);
row(HEROES.map((each) => [each, each === 'Yaarbro' ? "Yaarbro: Walblum's kick" : 'Caputo: Claw Slash']), 'hero', hero);
row(DIFFICULTIES, 'difficulty', difficulty);
row([['watch', 'Watch'], ['play', 'Play it yourself']], 'mode', watching ? 'watch' : 'play');
const again = document.createElement('div');
again.className = 'row';
const replay = document.createElement('button');
replay.textContent = 'Play it again';
replay.addEventListener('click', () => window.location.reload());
again.append(replay);
panel.append(again);
const note = document.createElement('div');
note.className = 'note';
note.textContent = watching
  ? 'Sent over and over until the target is beaten, then it starts again. The target only watches here.'
  : 'Arrow keys or WASD to move, Space to jump, X or Shift for the first move, and C or Z for the new one. On touch, the new round button.';
panel.append(note);
const show = (): void => {
  document.body.append(panel);
};
if (document.body) show();
else window.addEventListener('DOMContentLoaded', show);

await import('../../src/main');
