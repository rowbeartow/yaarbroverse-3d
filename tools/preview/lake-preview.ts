// The lake preview page's own part: it runs before the game (src/main.ts) and
// asks it, through `window.__grovePreview`, to start Cocolalla Lake at one
// place, on the difficulty and hero picked here, straight into play. "Watch"
// hands the controls to the rule tests' own bot (tests/helpers/bot.ts), which
// plays the place over and over; "Play it yourself" hands them to you.
//
// What is picked is kept in this browser's storage, so it survives the reload
// a new choice needs (an address after # is read first, for the stills
// script). The panel at the top left picks.
//
// Built by tools/preview/lake.mjs. Everything else on the page is the game
// itself: its scenery, its light, its camera, its sounds.

import type { Difficulty } from '../../src/game/difficulty';
import type { Game } from '../../src/game/game';
import type { HeroName } from '../../src/game/hero';
import { SPECIES } from '../../src/game/fishing';
import { IDLE } from '../../src/game/game';
import { Bot } from '../../tests/helpers/bot';
import { Fisher } from '../../tests/helpers/fisher';

interface Place {
  id: string;
  label: string;
  /** The solid the hero starts on. */
  at: string;
  /** Watching, the place starts over after the bot has stood here a moment. */
  until: string;
}

const PLACES: Place[] = [
  // First, so the page opens on it: the newest thing to look at. It starts on the pier's landing, the fight's checkpoint.
  // The new moves, for the owner's and the kids' OK: on the dock, with its scouts to send them at.
  { id: 'moves', label: "Walblum's kick and Claw Slash", at: 'dock', until: 'none' },
  { id: 'pike', label: 'The monster pike', at: 'landing', until: 'none' },
  { id: 'fishing', label: 'Fishing from the jetty', at: 'jetty', until: 'none' },
  { id: 'logs', label: 'Sinking logs', at: 'headland', until: 'gravel-bar' },
  { id: 'open', label: 'The Open Water', at: 'gravel-bar', until: 'reed-bar' },
  { id: 'tunnel', label: 'The Rock Tunnel', at: 'reed-bar', until: 'cove-beach' },
  { id: 'posts', label: 'Sinking posts and the pier', at: 'cove-beach', until: 'dock' },
  { id: 'shore', label: 'Huckleberries on the Shore Path', at: 'beach', until: 'point' },
  { id: 'crocodiles', label: 'Crocodile stepping stones', at: 'point', until: 'island' },
  { id: 'ropes', label: 'Rope swings', at: 'island', until: 'headland' },
];
const DIFFICULTIES: [Difficulty, string][] = [
  ['easy', 'Easy'],
  ['normal', 'Normal'],
  ['hard', 'Hard'],
];
const HEROES: HeroName[] = ['Yaarbro', 'Caputo'];

/** The choice: from the address after # when it has one (tools/preview/lake-stills.mjs), else the one this browser last made here. */
const KEPT = 'lake-preview-choice';
const kept = ((): string => {
  try {
    return window.localStorage.getItem(KEPT) ?? '';
  } catch {
    return '';
  }
})();
const asked = new URLSearchParams(window.location.hash.includes('=') ? window.location.hash.slice(1) : kept);
const place = PLACES.find((each) => each.id === asked.get('place')) ?? PLACES[0];
const difficulty = (DIFFICULTIES.find(([id]) => id === asked.get('difficulty'))?.[0] ?? 'normal') as Difficulty;
const hero = HEROES.find((each) => each === asked.get('hero')) ?? 'Yaarbro';
const watching = asked.get('mode') !== 'play';

let bot = new Bot();
/** Watching the fishing: the rule tests' fishing bot, after each kind of fish in turn. */
let fisher: Fisher | null = null;
let caught = 0;
const fish = (game: Game) => {
  const spot = game.level.fishing;
  if (!spot || !game.fishing) return IDLE;
  // Walk out onto the jetty first, with nothing on the dock in the way.
  for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
  const far = Math.hypot(spot.x - game.x, spot.z - game.z);
  if (game.fishing.phase === 'off' && far > spot.radius * 0.5) return { ...IDLE, moveX: (spot.x - game.x) / far, moveZ: (spot.z - game.z) / far };
  if (game.catches.length !== caught || !fisher) {
    caught = game.catches.length;
    fisher = new Fisher(SPECIES[caught % SPECIES.length]);
  }
  return fisher.input(game);
};
/**
 * Watching the new moves: the hero stands on the dock, turns to the nearest scout and sends the button at it,
 * again and again. The scouts stand still, do no harm and keep coming back, so the move is all there is to see.
 */
let pressFor = 0;
const moves = (game: Game) => {
  const dock = game.level.solids.find((s) => s.id === 'dock')!;
  // Stand at the south-west of the dock, where the camera sees the whole of it.
  const home = { x: dock.x - 1.5, z: dock.z + 2.4 };
  const scouts = game.enemies.filter((enemy) => enemy.spot.id.startsWith('scout-dock'));
  scouts.forEach((scout, index) => {
    // Each stands still a few metres off, out in plain view and doing no harm, and is back a moment after it is beaten.
    const at = { x: home.x + (index === 0 ? -2.2 : 2.6), z: home.z - (index === 0 ? 4.6 : 5.4) };
    if (scout.phase === 'defeated') {
      if (scout.timer > 1.6) Object.assign(scout, { phase: 'rest', timer: 0, hits: scout.maxHits, flash: 0 });
      return;
    }
    Object.assign(scout, { phase: 'rest', timer: 0, x: at.x, z: at.z, acorn: null });
  });
  const live = scouts.filter((scout) => scout.phase !== 'defeated').sort((a, b) => Math.hypot(a.x - game.x, a.z - game.z) - Math.hypot(b.x - game.x, b.z - game.z))[0];
  const off = Math.hypot(home.x - game.x, home.z - game.z);
  if (off > 1.2 || !live) return { ...IDLE, moveX: off > 0.3 ? (home.x - game.x) / off : 0, moveZ: off > 0.3 ? (home.z - game.z) / off : 0 };
  // A nudge toward the scout turns the hero to face it; then the button, pressed afresh each time it is ready.
  const far = Math.hypot(live.x - game.x, live.z - game.z) || 1;
  const facing = Math.atan2(live.x - game.x, live.z - game.z);
  const turned = Math.abs(Math.atan2(Math.sin(facing - game.facing), Math.cos(facing - game.facing))) < 0.3;
  pressFor = game.ability?.phase === 'ready' && turned ? pressFor + 1 : 0;
  return { ...IDLE, moveX: turned ? 0 : ((live.x - game.x) / far) * 0.6, moveZ: turned ? 0 : ((live.z - game.z) / far) * 0.6, attack: pressFor > 20 && pressFor < 26 };
};
let playing: Game | null = null;
/** The game time at which the bot came to stand where the place ends, or null. */
let stoodSince: number | null = null;
/** Set by tools/preview/lake-stills.mjs to hold the game still while it takes a picture. */
const page = window as unknown as { __previewHold?: boolean };
(window as unknown as { __grovePreview: unknown }).__grovePreview = {
  level: 'cocolalla',
  at: place.at,
  // Everywhere on this page the hero has the new button, to try: C on a keyboard, the orange button on touch.
  ability: true,
  difficulty,
  hero,
  pilot: watching
    ? (game: Game) => {
        // A fresh run gets a fresh bot.
        if (game !== playing) {
          playing = game;
          bot = new Bot();
          stoodSince = null;
          fisher = null;
          caught = 0;
        }
        if (place.id === 'moves') return moves(game);
        // The fishing bot goes after the ordinary fish; if the monster takes its lure, the test bot sees the fight through.
        if (place.id === 'fishing' && (!game.pike || game.pike.phase === 'lurking')) return fish(game);
        return bot.input(game);
      }
    : undefined,
  again: (game: Game) => {
    if (!watching) return false;
    const there = game.grounded && game.groundId === place.until;
    if (!there) stoodSince = null;
    else if (stoodSince === null) stoodSince = game.seconds;
    return stoodSince !== null && game.seconds - stoodSince > 1.5;
  },
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
#preview-panel .note { background: rgba(255,255,255,0.78); padding: 6px 10px; border-radius: 10px; max-width: 34em; font-weight: 500; }
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
row(DIFFICULTIES, 'difficulty', difficulty);
row(HEROES.map((each) => [each, each]), 'hero', hero);
row([['watch', 'Watch'], ['play', 'Play it yourself']], 'mode', watching ? 'watch' : 'play');
const note = document.createElement('div');
note.className = 'note';
note.textContent = watching
  ? 'The test bot is playing, over and over. Tap the picture once to hear it.'
  : 'Arrow keys or WASD to move, Space to jump, X for the hero\'s own move, C for the new button (Kick or Slash). On touch, thumbs as in the game, and the orange button.';
panel.append(note);
const show = (): void => {
  document.body.append(panel);
};
if (document.body) show();
else window.addEventListener('DOMContentLoaded', show);

await import('../../src/main');
