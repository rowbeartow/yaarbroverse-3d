// The marmot chief, the Bouncing Grove's boss: where it is, what it is, its
// numbers on each difficulty, its sidekicks, and the regen rule in the grove.
// How any boss fights is in tests/boss.test.ts.

import { describe, expect, it } from 'vitest';
import { BOSS, stageFor } from '../src/game/boss';
import { DIFFICULTIES } from '../src/game/difficulty';
import { ENEMY } from '../src/game/enemy';
import { Game, IDLE } from '../src/game/game';
import { HEROES, MOVE, STEP, fullJumpHeight } from '../src/game/hero';
import { GROVE_DIFFICULTY } from '../src/levels/bouncing-grove/difficulty';
import { GROVE_SHAPE, buildGrove } from '../src/levels/bouncing-grove/layout';
import { ENEMY_MODELS } from '../src/view/enemies';
import { Bot } from './helpers/bot';

const [easy, normal, hard] = DIFFICULTIES.map((difficulty) => GROVE_DIFFICULTY[difficulty]);

describe('the marmot chief', () => {
  it('is the marmot scout’s model, much larger and recoloured, and nothing else', () => {
    const boss = buildGrove('normal').boss!;
    expect(boss.name).toBe('The Marmot Chief');
    expect(boss.look.model).toBe('marmot');
    expect(ENEMY_MODELS[boss.look.model].file).toBe('marmot.glb');
    expect(boss.look.scale).toBeGreaterThanOrEqual(2);
    expect(boss.look.tint).toBeDefined();
    expect(boss.look.tint).not.toBe(0xffffff);
    // Its body in the rules is bigger than a scout's by about as much as it is drawn.
    expect(boss.radius / ENEMY.marmotRadius).toBeGreaterThan(2);
    expect(boss.height / ENEMY.marmotHeight).toBeGreaterThan(1.8);
  });

  it.each(DIFFICULTIES)('on %s: its bank is at the end of the grove, before the bough with the golden leaf, and is a checkpoint', (difficulty) => {
    const level = buildGrove(difficulty);
    const boss = level.boss!;
    const bank = level.solids.find((s) => s.id === 'bank-6')!;
    expect(level.route.slice(-2)).toEqual(['bank-6', 'bough']);
    expect(bank.safe).toBe(true);
    expect(boss.y).toBe(bank.top);
    // Its whole body stays on the bank.
    expect(boss.patch.minX - boss.radius).toBeGreaterThanOrEqual(bank.x - bank.halfX);
    expect(boss.patch.maxX + boss.radius).toBeLessThanOrEqual(bank.x + bank.halfX);
    expect(boss.patch.minZ - boss.radius).toBeGreaterThanOrEqual(bank.z - bank.halfZ);
    expect(boss.patch.maxZ + boss.radius).toBeLessThanOrEqual(bank.z + bank.halfZ);
    // A hero sent back stands on the doorstep, at least three metres short of where the fight begins.
    expect(bank.safeAt).toBeDefined();
    expect(bank.safeAt!.z - boss.arena.maxZ).toBeGreaterThanOrEqual(3);
    expect(bank.z + bank.halfZ - bank.safeAt!.z).toBeGreaterThan(1);
    // And well out of its reach while it waits.
    expect(Math.hypot(bank.safeAt!.x - boss.x, bank.safeAt!.z - boss.z)).toBeGreaterThan(8);
    // A full jump reaches its top, with the help this difficulty gives at ledges.
    expect(boss.height - level.ledgeHelp).toBeLessThan(fullJumpHeight() - 0.2);
    // The leaf is past the bank, over the bough.
    expect(level.leaf.z).toBeLessThan(bank.z - bank.halfZ);
  });

  it('on Easy any landing on top counts, and lines show where its attacks will go; on Normal and Hard only a hit while it rests, and no lines', () => {
    expect([easy.chief.guarded, normal.chief.guarded, hard.chief.guarded]).toEqual([false, true, true]);
    expect([easy.chief.aimLine, normal.chief.aimLine, hard.chief.aimLine]).toEqual([true, false, false]);
  });

  it('is harder on each difficulty: more health, shorter warnings and rests, more and faster acorns, a faster charge', () => {
    for (const [gentler, tougher] of [[easy.chief, normal.chief], [normal.chief, hard.chief]] as const) {
      expect(tougher.health).toBeGreaterThan(gentler.health);
      expect(tougher.warning).toBeLessThan(gentler.warning);
      expect(tougher.chargeWarning).toBeLessThan(gentler.chargeWarning);
      expect(tougher.rest).toBeLessThan(gentler.rest);
      expect(tougher.pause).toBeLessThan(gentler.pause);
      expect(tougher.acorns).toBeGreaterThan(gentler.acorns);
      expect(tougher.acornSpeed).toBeGreaterThan(gentler.acornSpeed);
      expect(tougher.chargeSpeed).toBeGreaterThan(gentler.chargeSpeed);
      expect(tougher.walkSpeed).toBeGreaterThan(gentler.walkSpeed);
    }
    expect(easy.chief.acorns).toBe(1);
    // Every warning is long enough to answer, and it never walks as fast as a hero.
    expect(hard.chief.warning).toBeGreaterThanOrEqual(0.33);
    expect(hard.chief.chargeWarning).toBeGreaterThanOrEqual(0.5);
    expect(hard.chief.walkSpeed).toBeLessThan(MOVE.walkSpeed / 2);
    // Its rest always leaves time to cross half its bank and land on it.
    expect(hard.chief.rest).toBeGreaterThanOrEqual(1.4);
  });

  it.each(DIFFICULTIES)('on %s: it throws, then charges as well, then calls its sidekicks too', (difficulty) => {
    const boss = buildGrove(difficulty).boss!;
    const { stages, health } = boss.numbers;
    expect(stages.map((stage) => stage.attacks)).toEqual([['throw'], ['charge', 'throw'], ['call', 'charge', 'throw']]);
    // Each stage lasts at least one hit, on every difficulty.
    const reached = new Set(Array.from({ length: health }, (_, i) => stageFor(boss, health - i)));
    expect([...reached].sort()).toEqual([0, 1, 2]);
    expect(stageFor(boss, health)).toBe(0);
    expect(stageFor(boss, 1)).toBe(2);
  });
});

describe('the chief’s sidekicks', () => {
  it('are giant mosquitoes: one on Easy, more on Normal and Hard', () => {
    expect(easy.chiefSidekicks).toBe(1);
    expect(normal.chiefSidekicks).toBeGreaterThan(easy.chiefSidekicks);
    expect(hard.chiefSidekicks).toBeGreaterThanOrEqual(normal.chiefSidekicks);
  });

  it.each(DIFFICULTIES)('on %s: they answer to the chief, keep to its bank, and lie low until called', (difficulty) => {
    const level = buildGrove(difficulty);
    const bank = level.solids.find((s) => s.id === 'bank-6')!;
    const spots = (level.enemies ?? []).filter((spot) => spot.sidekickOf);
    expect(spots).toHaveLength(GROVE_DIFFICULTY[difficulty].chiefSidekicks);
    for (const spot of spots) {
      expect([spot.kind, spot.sidekickOf]).toEqual(['mosquito', level.boss!.id]);
      expect(spot.arena.minX).toBeGreaterThanOrEqual(bank.x - bank.halfX);
      expect(spot.arena.maxX).toBeLessThanOrEqual(bank.x + bank.halfX);
      expect(spot.arena.minZ).toBeGreaterThanOrEqual(bank.z - bank.halfZ);
      expect(spot.arena.maxZ).toBeLessThanOrEqual(bank.z + bank.halfZ);
    }
    // No two wait in the same place.
    expect(new Set(spots.map((spot) => `${spot.x},${spot.z}`)).size).toBe(spots.length);
    const game = new Game(level, difficulty, 'Yaarbro');
    expect(game.enemies.filter((enemy) => enemy.spot.sidekickOf).every((enemy) => enemy.dormant)).toBe(true);
  });

  it('on Easy they are easy to avoid: slow to follow, with a long warning', () => {
    const tuning = buildGrove('easy').enemyTuning!;
    expect(tuning.followSpeed).toBeLessThan(MOVE.walkSpeed / 3);
    expect(ENEMY.warning * tuning.warning).toBeGreaterThanOrEqual(1.2);
  });

  it('a mosquito that hovers high climbs back over the hero’s head before it warns again', () => {
    const level = buildGrove('hard');
    const game = new Game(level, 'hard', 'Yaarbro');
    const bank = level.solids.find((s) => s.id === 'bough-3')!;
    const bug = game.enemies.find((enemy) => enemy.spot.id === 'mosquito-boughs')!;
    Object.assign(game, { x: bank.x, y: bank.top, z: bank.z, vx: 0, vy: 0, vz: 0, grounded: true });
    // It has just rested low, where it dived to.
    Object.assign(bug, { x: bank.x, z: bank.z + 3, y: bank.top + 0.9, phase: 'idle', timer: 5 });
    let warnedAt = -1;
    for (let i = 0; i < 3 / STEP && warnedAt < 0; i += 1) {
      game.protectedFor = 1;
      game.step(IDLE);
      if (bug.phase === 'warning') warnedAt = bug.y;
    }
    // Over the top of a standing hero, with room to spare.
    expect(warnedAt - ENEMY.mosquitoHalfHeight).toBeGreaterThan(bank.top + MOVE.bodyHeight + 0.5);
  });
});

describe('fighting the chief in the grove', () => {
  /** Follows the bot to the chief's bank, then into the fight until the chief has taken a hit. */
  const intoTheFight = (difficulty: (typeof DIFFICULTIES)[number], hero: (typeof HEROES)[number]): Game => {
    const level = buildGrove(difficulty);
    const game = new Game(level, difficulty, hero);
    const bot = new Bot(level);
    const full = level.boss!.numbers.health;
    for (let i = 0; i < 300 / STEP && game.boss!.health === full; i += 1) game.step(bot.input(game));
    expect(game.boss!.health).toBe(full - 1);
    return game;
  };

  it.each(DIFFICULTIES)('on %s: the leaf cannot be taken while the chief stands', (difficulty) => {
    const level = buildGrove(difficulty);
    const game = new Game(level, difficulty, 'Yaarbro');
    Object.assign(game, { x: level.leaf.x, y: level.leaf.y - 0.8, z: level.leaf.z, grounded: false });
    game.step(IDLE);
    expect(game.complete).toBe(false);
  });

  it.each(HEROES)('the regen rule: %s damages the chief on Hard, falls, comes back to the doorstep, and finds it at full health and at home', (hero) => {
    const game = intoTheFight('hard', hero);
    const boss = game.boss!;
    const bank = game.level.solids.find((s) => s.id === 'bank-6')!;
    Object.assign(game, { x: bank.x + bank.halfX + 3, vx: 0, vz: 0 });
    for (let i = 0; i < 20 / STEP && game.falls === 0; i += 1) game.step(IDLE);
    expect(game.falls).toBe(1);
    expect(game.groundId).toBe('bank-6');
    expect([game.x, game.z]).toEqual([bank.safeAt!.x, bank.safeAt!.z]);
    expect([boss.health, boss.phase, boss.x, boss.z]).toEqual([boss.spot.numbers.health, 'waiting', boss.spot.x, boss.spot.z]);
    // Standing on the doorstep does not start the fight. Stepping in does, after a moment.
    for (let i = 0; i < 4 / STEP; i += 1) game.step(IDLE);
    expect(boss.phase).toBe('waiting');
    for (let i = 0; i < 2 / STEP && boss.phase === 'waiting'; i += 1) game.step({ ...IDLE, moveZ: -1 });
    expect(boss.phase).toBe('intro');
    expect(boss.fights).toBe(2);
  });

  it('running out of hearts in the fight does the same, with every heart back', () => {
    const game = intoTheFight('normal', 'Yaarbro');
    const boss = game.boss!;
    for (let i = 0; i < 60 / STEP && game.hearts > 0; i += 1) {
      game.protectedFor = 0;
      game.hurt(boss.x, boss.z);
      game.step(IDLE);
    }
    for (let i = 0; i < 2 / STEP; i += 1) game.step(IDLE);
    expect(game.hearts).toBe(game.level.hearts);
    expect(game.groundId).toBe('bank-6');
    expect(boss.health).toBe(boss.spot.numbers.health);
    expect(game.enemies.filter((enemy) => enemy.spot.sidekickOf).every((enemy) => enemy.dormant)).toBe(true);
  });

  it('on Easy it can be beaten by jumping on it alone, at any time it is not staggered', () => {
    const level = buildGrove('easy');
    const game = new Game(level, 'easy', 'Yaarbro');
    const bank = level.solids.find((s) => s.id === 'bank-6')!;
    const boss = game.boss!;
    Object.assign(game, { x: bank.x, y: bank.top, z: boss.spot.arena.maxZ - 1, vx: 0, vy: 0, vz: 0, grounded: true });
    for (let i = 0; i < (BOSS.intro + 0.2) / STEP; i += 1) game.step(IDLE);
    // Drop onto it while it is on watch, again and again, waiting out each stagger.
    for (let hits = 0; hits < boss.spot.numbers.health; hits += 1) {
      for (let i = 0; i < 4 / STEP && (boss.phase === 'stagger' || boss.phase === 'roar'); i += 1) {
        Object.assign(game, { x: bank.x, z: boss.spot.arena.maxZ - 1, y: bank.top, vy: 0, grounded: true, protectedFor: 1 });
        game.step(IDLE);
      }
      const before = boss.health;
      Object.assign(game, { x: boss.x, z: boss.z, y: bank.top + 2.4, vx: 0, vy: -3, vz: 0, grounded: false, protectedFor: 1 });
      for (let i = 0; i < 40 && boss.health === before; i += 1) game.step(IDLE);
      expect(boss.health).toBe(before - 1);
    }
    expect(boss.phase).toBe('defeated');
    expect(game.movesUsed).toBe(0);
    expect(game.goalOpen).toBe(true);
  });

  it('its bank is wide: there is room to get out of the way of a charge on either side', () => {
    expect(GROVE_SHAPE.chiefHalfWidth * 2).toBeGreaterThan(6 * (GROVE_SHAPE.chiefRadius + MOVE.bodyRadius));
  });
});
