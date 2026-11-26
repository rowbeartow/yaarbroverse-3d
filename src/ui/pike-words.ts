// What the game says during the monster pike fight (src/game/pike.ts). No
// browser code, so the tests can read it.

import type { GameEvent } from '../game/game';

type PikeEvent = Extract<GameEvent, { type: 'pike' }>;

/** The line for something the pike did, or null when it needs none. `guarded`: only a hit while it lies spent counts (Hard). */
export const pikeNews = (event: PikeEvent, name: string, guarded: boolean): string | null => {
  switch (event.what) {
    case 'hooked':
      return `${name} is on the line! Reel while it tires. Let go when it thrashes.`;
    case 'away':
      return `${name} got away. Cast at its shadow again!`;
    case 'dragged':
      return 'It is dragging you in! Swim to the floating log.';
    case 'hit':
      if (event.left <= 0) return null;
      return event.how === 'line' ? `Keep reeling! ${event.left} to go.` : `${name} hit! ${event.left} more to go.`;
    case 'blocked':
      return guarded ? 'It shrugs that off. Hit it when it lies still!' : 'It shrugs that off. Hit it when its jaws are open!';
    case 'phase':
      if (event.phase === 'charge-tell') return 'Its fin is up: it is coming for you. Out of its way, or onto the log!';
      if (event.phase === 'gape') return guarded ? 'Jaws! Step away along the log, then jump on it.' : 'Jaws! Step away, or jump on its head!';
      return null;
    case 'beaten':
      return `${name} is beaten!`;
    case 'reset':
      return `${name} is back to full strength.`;
  }
};

type RescueEvent = Extract<GameEvent, { type: 'rescue' }>;

/** The line for something in a level's rescue (src/game/rescue.ts), or null. */
export const rescueNews = (event: RescueEvent, name: string): string | null => {
  if (event.what === 'rescued') return null;
  if (event.phase === 'paddling') return `${name} is swimming for the dock! Meet him at the end of it.`;
  if (event.phase === 'waiting') return `${name} is waiting under the golden leaf.`;
  return null;
};
