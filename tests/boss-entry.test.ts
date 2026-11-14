// The test bot's boss fight does not hang on one rehearsed way in. For every
// level with a boss, on every difficulty and as each hero, the bot walks into
// the arena from many places across its near side, standing or already
// running, and must win its first fight without a fall and without running
// out of hearts. If one of these fails, look at the bot's look-ahead
// (`fightSafely` in tests/helpers/bot.ts) before the boss's numbers.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game } from '../src/game/game';
import { HEROES, MOVE, STEP } from '../src/game/hero';
import { surfaceBelow } from '../src/game/level';
import { LEVELS } from '../src/levels';
import { Bot } from './helpers/bot';

/** Across the arena's near side, as shares of the way from its middle to its edge. */
const ACROSS = [-0.8, -0.5, -0.25, 0, 0.25, 0.5, 0.8];

const withBoss = LEVELS.filter((entry) => entry.build('normal').boss);

describe.each(withBoss.map((entry) => [entry.id, entry] as const))('the bot fights the boss of %s', (_id, entry) => {
  it('there is at least one level with a boss to fight', () => expect(withBoss.length).toBeGreaterThan(0));

  const ways = ACROSS.flatMap((share) => [false, true].map((running) => [`from ${share} of the way across${running ? ', already running' : ''}`, share, running] as const));

  describe.each(DIFFICULTIES)('on %s', (difficulty) => {
    describe.each(HEROES)('as %s', (hero) => {
      it.each(ways)('wins its first fight %s, with no fall and hearts to spare', (_way, share, running) => {
        const game = new Game(entry.build(difficulty), difficulty, hero);
        const boss = game.boss!;
        const { arena } = boss.spot;
        // Its arena stands on one solid: start on that, just short of where the fight begins.
        const ground = surfaceBelow(game.level, boss.spot.x, boss.spot.z, boss.spot.y + 0.01, MOVE.footRadius)!;
        const halfWidth = Math.min(ground.halfX, (arena.maxX - arena.minX) / 2) - 1;
        game.x = (arena.minX + arena.maxX) / 2 + share * halfWidth;
        game.z = Math.min(arena.maxZ + 1.2, ground.z + ground.halfZ - 0.8);
        game.y = ground.top;
        game.groundId = ground.id;
        game.grounded = true;
        if (running) game.vz = -MOVE.walkSpeed;
        const bot = new Bot(game.level);
        for (let i = 0; i < 240 / STEP && boss.phase !== 'defeated' && boss.fights < 2 && game.falls === 0; i += 1) game.step(bot.input(game));
        expect({ phase: boss.phase, fights: boss.fights, falls: game.falls }).toEqual({ phase: 'defeated', fights: 1, falls: 0 });
        expect(game.heartsLost).toBeLessThan(game.level.hearts);
      });
    });
  });
});
