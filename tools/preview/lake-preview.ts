// The lake preview page's own part: it runs before the game (src/main.ts) and
// asks it, through `window.__grovePreview`, to start Cocolalla Lake at one
// place, on the difficulty and hero picked here, straight into play. "Watch"
// hands the controls to the rule tests' own bot (tests/helpers/bot.ts), which
// plays the place over and over; "Play it yourself" hands them to you.
//
// What is picked lives in the page's address after # (so the choice survives
// the reload that a new choice needs). The panel at the top left picks.
//
// Built by tools/preview/lake.mjs. Everything else on the page is the game
// itself: its scenery, its light, its camera, its sounds.

import type { Difficulty } from '../../src/game/difficulty';
import type { Game } from '../../src/game/game';
import type { HeroName } from '../../src/game/hero';
import { Bot } from '../../tests/helpers/bot';

interface Place {
  id: string;
  label: string;
  /** The solid the hero starts on. */
  at: string;
  /** Watching, the place starts over after the bot has stood here a moment. */
  until: string;
}

const PLACES: Place[] = [
  { id: 'crocodiles', label: 'Crocodile stepping stones', at: 'point', until: 'island' },
  { id: 'ropes', label: 'Rope swings', at: 'island', until: 'headland' },
];
const DIFFICULTIES: [Difficulty, string][] = [
  ['easy', 'Easy'],
  ['normal', 'Normal'],
  ['hard', 'Hard'],
];
const HEROES: HeroName[] = ['Yaarbro', 'Caputo'];

const asked = new URLSearchParams(window.location.hash.slice(1));
const place = PLACES.find((each) => each.id === asked.get('place')) ?? PLACES[0];
const difficulty = (DIFFICULTIES.find(([id]) => id === asked.get('difficulty'))?.[0] ?? 'normal') as Difficulty;
const hero = HEROES.find((each) => each === asked.get('hero')) ?? 'Yaarbro';
const watching = asked.get('mode') !== 'play';

let bot = new Bot();
let playing: Game | null = null;
/** The game time at which the bot came to stand where the place ends, or null. */
let stoodSince: number | null = null;
/** Set by tools/preview/lake-stills.mjs to hold the game still while it takes a picture. */
const page = window as unknown as { __previewHold?: boolean };
(window as unknown as { __grovePreview: unknown }).__grovePreview = {
  level: 'cocolalla',
  at: place.at,
  difficulty,
  hero,
  pilot: watching
    ? (game: Game) => {
        // A fresh run gets a fresh bot.
        if (game !== playing) {
          playing = game;
          bot = new Bot();
          stoodSince = null;
        }
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
      const next = new URLSearchParams(window.location.hash.slice(1));
      next.set(key, id);
      window.location.hash = next.toString();
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
  : 'Arrow keys or WASD to move, Space to jump. On the iPad, thumbs as in the game.';
panel.append(note);
const show = (): void => {
  document.body.append(panel);
};
if (document.body) show();
else window.addEventListener('DOMContentLoaded', show);

await import('../../src/main');
