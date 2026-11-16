// THE KEYBOARD RULE (the owner's, 2026-11-16): every level can be finished on
// Easy and Normal with a keyboard, as each hero. The test bot steers at any
// angle, which no keyboard can, so here it plays through what a keyboard can
// send (tests/helpers/keyboard.ts): eight directions relative to the camera,
// the camera turning as it does in the game, no key changed faster than a
// quick tap, and in the air one direction for the whole jump.
//
// It finds what the bot alone missed: on the live lake before this rule, the
// keys ran at an angle to the crocodile stepping stones, and a keyboard
// player could not get past the first crocodile on Normal.
//
// Each run prints nothing; a failure says where the hero was last safe.

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { HEROES } from '../src/game/hero';
import { LEVELS } from '../src/levels';
import { playWithKeyboard } from './helpers/keyboard';

describe.each(LEVELS.map((entry) => [entry.id, entry] as const))('%s with a keyboard', (_id, entry) => {
  describe.each(['easy', 'normal'] as const)('on %s', (difficulty) => {
    it.each(HEROES)('gets to the golden leaf as %s', (hero) => {
      const game = playWithKeyboard(new Game(entry.build(difficulty), difficulty, hero), 300);
      expect(game.complete, `last safe on ${game.safe.id ?? 'the start'}, ${game.falls} falls`).toBe(true);
    });
  });
});
