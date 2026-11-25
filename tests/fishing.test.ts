// Fishing (src/game/fishing.ts): casting, bites, reeling, the line snapping,
// and what each difficulty changes. The lake's own fishing is played by a bot
// on every difficulty as each hero.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/game/difficulty';
import { FISHING, SPECIES, bigness, dropLine, fishingPoint, newFishing, onSpot, stepFishing, type FishingEvent, type FishingInput, type FishingSpot, type FishingState, type Species } from '../src/game/fishing';
import { Game, IDLE, type GameEvent } from '../src/game/game';
import { STEP, type HeroName } from '../src/game/hero';
import { buildLake } from '../src/levels/cocolalla/layout';
import { LAKE_DIFFICULTY } from '../src/levels/cocolalla/difficulty';
import { Fisher, catchOne } from './helpers/fisher';

const spotOn = (difficulty: Difficulty): FishingSpot => buildLake(difficulty).fishing!;
const NOTHING: FishingInput = { button: false, jump: false, across: 0 };
const BUTTON: FishingInput = { ...NOTHING, button: true };

/** Steps fishing with one input until `until` says stop, collecting what happened. */
const run = (state: FishingState, spot: FishingSpot, input: FishingInput, until: (events: FishingEvent[]) => boolean, seconds = 60): FishingEvent[] => {
  const all: FishingEvent[] = [];
  for (let i = 0; i < seconds / STEP; i += 1) {
    const events = stepFishing(state, spot, input, true, STEP);
    all.push(...events);
    if (until(events)) break;
  }
  return all;
};
const happened = (what: FishingEvent['what']) => (events: FishingEvent[]) => events.some((event) => event.what === what);

/** Casts so the lure lands on the fish of a kind (the ring is put there by hand), and waits for the plop. */
const castAt = (state: FishingState, spot: FishingSpot, species: Species, off = 0.3): void => {
  stepFishing(state, spot, BUTTON, true, STEP);
  expect(state.phase).toBe('aim');
  const fish = state.fish.find((each) => each.species === species)!;
  state.out = fish.out - off;
  state.across = fish.across;
  // Hold the fish where it is, so the cast is judged against a known place.
  fish.home = { out: fish.out, across: fish.across };
  stepFishing(state, spot, NOTHING, true, STEP);
  run(state, spot, NOTHING, happened('plop'));
};

describe('the fishing spot', () => {
  it('starts with every kind of fish in its own water, nearest the jetty first', () => {
    const spot = spotOn('normal');
    const state = newFishing(spot);
    for (const species of SPECIES) {
      const fish = state.fish.filter((each) => each.species === species);
      const numbers = spot.numbers.species[species];
      expect(fish.length, species).toBe(numbers.count);
      for (const each of fish) {
        expect(each.out).toBeGreaterThanOrEqual(numbers.zone[0]);
        expect(each.out).toBeLessThanOrEqual(numbers.zone[1]);
        expect(each.size).toBeGreaterThanOrEqual(numbers.size[0]);
        expect(each.size).toBeLessThanOrEqual(numbers.size[1]);
        expect(Math.abs(each.across)).toBeLessThanOrEqual(spot.halfWidth);
      }
    }
    const middle = (species: Species) => (spot.numbers.species[species].zone[0] + spot.numbers.species[species].zone[1]) / 2;
    expect(middle('perch')).toBeLessThan(middle('bass'));
    expect(middle('bass')).toBeLessThan(middle('trout'));
    expect(middle('trout')).toBeLessThan(middle('pike'));
  });

  it('the same run always meets the same fish', () => {
    const spot = spotOn('hard');
    expect(newFishing(spot).fish).toEqual(newFishing(spot).fish);
  });

  it('every fish stays in the water a cast can reach, and in the pool', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const spot = level.fishing!;
      const state = newFishing(spot);
      const pool = level.water!.find((w) => w.id === 'pier-water')!;
      for (let i = 0; i < 60 / STEP; i += 1) stepFishing(state, spot, NOTHING, true, STEP);
      for (const fish of state.fish) {
        const at = fishingPoint(spot, fish.out, fish.across);
        expect(at.x).toBeGreaterThan(pool.minX);
        expect(at.x).toBeLessThan(pool.maxX);
        expect(at.z).toBeGreaterThan(pool.minZ);
        expect(at.z).toBeLessThan(pool.maxZ);
        // And clear of every solid: a fish never swims through a post.
        for (const solid of level.solids) {
          const inside = Math.abs(at.x - solid.x) < solid.halfX && Math.abs(at.z - solid.z) < solid.halfZ && solid.bottom < spot.surface;
          expect(inside, `${fish.species} inside ${solid.id}`).toBe(false);
        }
      }
    }
  });
});

describe('casting', () => {
  it('holding the button slides the ring out and back between the near and far ends', () => {
    const spot = spotOn('normal');
    const state = newFishing(spot);
    stepFishing(state, spot, BUTTON, true, STEP);
    expect(state.phase).toBe('aim');
    let furthest = 0;
    let nearest = Infinity;
    for (let i = 0; i < 12 / STEP; i += 1) {
      stepFishing(state, spot, BUTTON, true, STEP);
      furthest = Math.max(furthest, state.out);
      nearest = Math.min(nearest, state.out);
      expect(state.phase).toBe('aim');
    }
    expect(furthest).toBeCloseTo(spot.far, 5);
    expect(nearest).toBeCloseTo(spot.near, 5);
  });

  it('the stick moves the ring to either side, never past the edge of the water', () => {
    const spot = spotOn('normal');
    const state = newFishing(spot);
    stepFishing(state, spot, BUTTON, true, STEP);
    for (let i = 0; i < 4 / STEP; i += 1) stepFishing(state, spot, { ...BUTTON, across: 1 }, true, STEP);
    expect(state.across).toBeCloseTo(spot.halfWidth, 5);
    for (let i = 0; i < 6 / STEP; i += 1) stepFishing(state, spot, { ...BUTTON, across: -1 }, true, STEP);
    expect(state.across).toBeCloseTo(-spot.halfWidth, 5);
  });

  it('letting go casts: the lure lands where the ring was', () => {
    const spot = spotOn('normal');
    const state = newFishing(spot);
    stepFishing(state, spot, BUTTON, true, STEP);
    for (let i = 0; i < 1 / STEP; i += 1) stepFishing(state, spot, BUTTON, true, STEP);
    const ring = { out: state.out, across: state.across };
    const events = run(state, spot, NOTHING, happened('plop'));
    expect(events.map((event) => event.what)).toEqual(['cast', 'plop']);
    expect(state.phase).toBe('wait');
    expect(state.out).toBeCloseTo(ring.out, 1);
    expect(state.across).toBe(ring.across);
  });

  it('on Easy the lure lands beside the nearest fish wherever the ring is', () => {
    const spot = spotOn('easy');
    const state = newFishing(spot);
    stepFishing(state, spot, BUTTON, true, STEP);
    // Let go at once: the ring has hardly left the jetty.
    stepFishing(state, spot, NOTHING, true, STEP);
    const nearest = Math.min(...state.fish.map((fish) => Math.hypot(fish.out - state.out, fish.across - state.across)));
    expect(nearest).toBeLessThan(1);
    // And that fish comes and bites with nothing more asked of the player.
    const events = run(state, spot, NOTHING, happened('bite'));
    expect(events.some((event) => event.what === 'bite')).toBe(true);
  });

  it('on Normal and Hard a lure that lands too far from every fish brings none, and nothing is lost', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const spot = spotOn(difficulty);
      const state = newFishing(spot);
      const perch = state.fish.find((fish) => fish.species === 'perch')!;
      // Park every fish far from where the lure will land.
      for (const fish of state.fish) {
        fish.out = spot.far;
        fish.across = spot.halfWidth * 0.8;
        fish.home = { out: fish.out, across: fish.across };
      }
      stepFishing(state, spot, BUTTON, true, STEP);
      state.out = spot.near;
      state.across = -spot.halfWidth;
      stepFishing(state, spot, NOTHING, true, STEP);
      const events = run(state, spot, NOTHING, () => false, 8);
      expect(events.some((event) => event.what === 'nibble' || event.what === 'bite')).toBe(false);
      expect(state.phase).toBe('wait');
      expect(perch.mood).toBe('idle');
      // Jump winds in, and the next press casts again.
      expect(stepFishing(state, spot, { ...NOTHING, jump: true }, true, STEP)).toEqual([{ what: 'stop' }]);
      expect(state.phase).toBe('off');
    }
  });

  it('how near the lure must land: 2.5 m on Normal, 1.2 m on Hard', () => {
    expect(LAKE_DIFFICULTY.normal.fishing.notice).toBe(2.5);
    expect(LAKE_DIFFICULTY.hard.fishing.notice).toBe(1.2);
    const spot = spotOn('hard');
    const state = newFishing(spot);
    castAt(state, spot, 'perch', 2);
    expect(run(state, spot, NOTHING, () => false, 6).some((event) => event.what === 'bite')).toBe(false);
  });

  it('on Hard a lure dropped on a trout scares it off', () => {
    const spot = spotOn('hard');
    const state = newFishing(spot);
    stepFishing(state, spot, BUTTON, true, STEP);
    const trout = state.fish.find((fish) => fish.species === 'trout')!;
    state.out = trout.out;
    state.across = trout.across;
    stepFishing(state, spot, NOTHING, true, STEP);
    const events = run(state, spot, NOTHING, happened('plop'));
    expect(events.some((event) => event.what === 'scared')).toBe(true);
    expect(trout.mood).toBe('fleeing');
  });
});

describe('bites', () => {
  it('a fish near the lure comes over, nibbles as its kind does, then bites', () => {
    const spot = spotOn('normal');
    for (const species of SPECIES) {
      const state = newFishing(spot);
      castAt(state, spot, species);
      const events = run(state, spot, NOTHING, happened('bite'));
      const nibbles = events.filter((event) => event.what === 'nibble').length;
      const [least, most] = spot.numbers.species[species].nibbles;
      expect(nibbles, species).toBeGreaterThanOrEqual(least);
      expect(nibbles, species).toBeLessThanOrEqual(most);
      expect(events.at(-1)).toEqual({ what: 'bite', species });
      expect(state.phase).toBe('bite');
    }
  });

  it('the pike never nibbles: the bobber just goes', () => {
    for (const difficulty of DIFFICULTIES) {
      const spot = spotOn(difficulty);
      const state = newFishing(spot);
      castAt(state, spot, 'pike');
      expect(run(state, spot, NOTHING, happened('bite')).filter((event) => event.what === 'nibble')).toEqual([]);
    }
  });

  it('pressing while the bite lasts hooks the fish', () => {
    const spot = spotOn('normal');
    const state = newFishing(spot);
    castAt(state, spot, 'bass');
    run(state, spot, NOTHING, happened('bite'));
    expect(stepFishing(state, spot, BUTTON, true, STEP)).toEqual([{ what: 'hooked', species: 'bass' }]);
    expect(state.phase).toBe('hooked');
  });

  it('a bite lasts 1.5 seconds on Normal and 0.7 on Hard: too late, and the fish is gone but the lure stays out', () => {
    for (const [difficulty, window] of [['normal', 1.5], ['hard', 0.7]] as const) {
      const spot = spotOn(difficulty);
      expect(spot.numbers.biteWindow).toBe(window);
      const state = newFishing(spot);
      castAt(state, spot, 'pike');
      run(state, spot, NOTHING, happened('bite'));
      const fish = state.fish.find((each) => each.id === state.taker)!;
      let waited = 0;
      while (state.phase === 'bite') {
        stepFishing(state, spot, NOTHING, true, STEP);
        waited += STEP;
      }
      expect(waited).toBeCloseTo(window, 1);
      expect(state.phase).toBe('wait');
      expect(fish.mood).toBe('fleeing');
    }
  });

  it('on Easy a fish hooks itself and waits: the press can come any time', () => {
    const spot = spotOn('easy');
    const state = newFishing(spot);
    castAt(state, spot, 'trout');
    run(state, spot, NOTHING, happened('bite'));
    for (let i = 0; i < 30 / STEP; i += 1) stepFishing(state, spot, NOTHING, true, STEP);
    expect(state.phase).toBe('bite');
    expect(stepFishing(state, spot, BUTTON, true, STEP)).toEqual([{ what: 'hooked', species: 'trout' }]);
  });

  it('on Hard pressing on a nibble scares the fish; on Normal it does not', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const spot = spotOn(difficulty);
      const state = newFishing(spot);
      castAt(state, spot, 'trout');
      run(state, spot, NOTHING, happened('nibble'));
      const events = stepFishing(state, spot, BUTTON, true, STEP);
      stepFishing(state, spot, NOTHING, true, STEP);
      if (difficulty === 'hard') expect(events).toEqual([{ what: 'scared' }]);
      else expect(run(state, spot, NOTHING, happened('bite')).at(-1)?.what).toBe('bite');
    }
  });
});

/** Hooks a fish of a kind and returns the state at the first step of the fight. */
const hook = (spot: FishingSpot, species: Species): FishingState => {
  const state = newFishing(spot);
  castAt(state, spot, species);
  run(state, spot, NOTHING, happened('bite'));
  stepFishing(state, spot, BUTTON, true, STEP);
  expect(state.phase).toBe('hooked');
  return state;
};

describe('reeling', () => {
  it('holding the button while the fish tires brings the line in', () => {
    const spot = spotOn('normal');
    const state = hook(spot, 'bass');
    const before = state.line;
    for (let i = 0; i < 1 / STEP && state.fight !== 'thrash'; i += 1) stepFishing(state, spot, BUTTON, true, STEP);
    expect(state.line).toBeLessThan(before - 1);
    expect(state.strain).toBe(0);
  });

  it('a thrash is warned of first, for as long as the difficulty says', () => {
    for (const [difficulty, tell] of [['easy', 1], ['normal', 0.7], ['hard', 0.4]] as const) {
      const spot = spotOn(difficulty);
      expect(spot.numbers.tell).toBe(tell);
      const state = hook(spot, 'trout');
      run(state, spot, NOTHING, happened('tell'));
      let warned = 0;
      while (state.fight === 'tell') {
        stepFishing(state, spot, NOTHING, true, STEP);
        warned += STEP;
      }
      expect(warned).toBeCloseTo(tell, 1);
      expect(state.fight).toBe('thrash');
    }
  });

  it('letting the line run through a thrash keeps it whole, and the fish takes line', () => {
    const spot = spotOn('hard');
    const state = hook(spot, 'trout');
    run(state, spot, BUTTON, happened('thrash'));
    const before = state.line;
    const events = run(state, spot, NOTHING, happened('calm'));
    expect(events.some((event) => event.what === 'snapped')).toBe(false);
    expect(state.line).toBeGreaterThan(before);
    expect(state.strain).toBe(0);
  });

  it('a fish that is not being reeled takes line back on Normal and Hard, and none on Easy', () => {
    for (const difficulty of DIFFICULTIES) {
      const spot = spotOn(difficulty);
      const state = hook(spot, 'bass');
      const before = state.line;
      for (let i = 0; i < 0.5 / STEP; i += 1) stepFishing(state, spot, NOTHING, true, STEP);
      if (difficulty === 'easy') expect(state.line).toBe(before);
      else expect(state.line).toBeGreaterThan(before);
    }
  });

  it('reeled all the way in, the fish is landed, held up, and another of its kind takes its place', () => {
    const spot = spotOn('normal');
    const state = newFishing(spot);
    const game = { state, spot };
    castAt(game.state, spot, 'perch');
    run(state, spot, NOTHING, happened('bite'));
    stepFishing(state, spot, BUTTON, true, STEP);
    const fish = state.fish.find((each) => each.id === state.taker)!;
    const all: FishingEvent[] = [];
    for (let i = 0; i < 60 / STEP && state.phase === 'hooked'; i += 1) all.push(...stepFishing(state, spot, state.fight === 'thrash' ? NOTHING : BUTTON, true, STEP));
    expect(all.at(-1)).toEqual({ what: 'landed', species: 'perch', size: fish.size });
    expect(state.phase).toBe('show');
    expect(state.shown).toEqual({ species: 'perch', size: fish.size });
    // The hero holds it up for a moment, then is free again.
    run(state, spot, NOTHING, happened('stop'));
    expect(state.phase).toBe('off');
    for (let i = 0; i < (FISHING.restock + 1) / STEP; i += 1) stepFishing(state, spot, NOTHING, true, STEP);
    expect(state.fish.filter((each) => each.species === 'perch').length).toBe(spot.numbers.species.perch.count);
    expect(state.fish.some((each) => each.id === fish.id)).toBe(false);
  });

  it('a bigger fish thrashes for longer', () => {
    const spot = spotOn('normal');
    expect(bigness(spot, { species: 'pike', size: 50 })).toBe(0);
    expect(bigness(spot, { species: 'pike', size: 110 })).toBe(1);
    const thrash = (size: number): number => {
      const state = newFishing(spot);
      state.fish.find((each) => each.species === 'pike')!.size = size;
      castAt(state, spot, 'pike');
      run(state, spot, NOTHING, happened('bite'));
      stepFishing(state, spot, BUTTON, true, STEP);
      run(state, spot, NOTHING, happened('thrash'));
      return state.fightFor;
    };
    expect(thrash(110)).toBeGreaterThan(thrash(50) * 1.5);
  });
});

describe('the line snapping', () => {
  it('reeling through a thrash strains the line, and it snaps after 1.5 seconds on Normal and 0.8 on Hard', () => {
    for (const [difficulty, snap] of [['normal', 1.5], ['hard', 0.8]] as const) {
      const spot = spotOn(difficulty);
      expect(spot.numbers.snap).toBe(snap);
      const state = hook(spot, 'pike');
      // The biggest pike: its thrash outlasts the line.
      state.fish.find((each) => each.id === state.taker)!.size = 110;
      run(state, spot, BUTTON, happened('thrash'));
      let reeled = 0;
      let events: FishingEvent[] = [];
      while (state.phase === 'hooked') {
        events = stepFishing(state, spot, BUTTON, true, STEP);
        reeled += STEP;
      }
      expect(events).toEqual([{ what: 'snapped' }]);
      expect(reeled).toBeCloseTo(snap, 1);
      expect(state.phase).toBe('lost');
      // The fish got away, and after a moment the hero can cast again.
      run(state, spot, NOTHING, happened('stop'));
      expect(state.phase).toBe('off');
      expect(state.fish.some((each) => each.mood === 'landed')).toBe(false);
    }
  });

  it('easing off in time saves it: the strain falls away', () => {
    const spot = spotOn('normal');
    const state = hook(spot, 'pike');
    state.fish.find((each) => each.id === state.taker)!.size = 110;
    run(state, spot, BUTTON, happened('thrash'));
    for (let i = 0; i < 1 / STEP; i += 1) stepFishing(state, spot, BUTTON, true, STEP);
    expect(state.strain).toBeGreaterThan(0.5);
    expect(state.phase).toBe('hooked');
    for (let i = 0; i < 0.5 / STEP; i += 1) stepFishing(state, spot, NOTHING, true, STEP);
    expect(state.strain).toBeLessThan(0.3);
    expect(state.phase).toBe('hooked');
  });

  it('on Easy the line never snaps: holding the button the whole time lands every kind of fish', () => {
    const spot = spotOn('easy');
    expect(spot.numbers.snap).toBe(Infinity);
    for (const species of SPECIES) {
      const state = hook(spot, species);
      const events = run(state, spot, BUTTON, happened('landed'), 120);
      expect(events.some((event) => event.what === 'snapped' || event.what === 'away'), species).toBe(false);
      expect(events.at(-1)?.what, species).toBe('landed');
      expect(state.strain).toBe(0);
    }
  });

  it('a fish left to run takes all the line and is gone', () => {
    const spot = spotOn('hard');
    const state = hook(spot, 'pike');
    const events = run(state, spot, NOTHING, (each) => each.some((event) => event.what === 'away' || event.what === 'landed'), 240);
    expect(events.at(-1)).toEqual({ what: 'away' });
    expect(state.phase).toBe('lost');
  });
});

describe('fishing in the game', () => {
  const fishingEvents = (events: GameEvent[]) => events.filter((event) => event.type === 'fishing');

  it('the spot is on the jetty, off the dock and its scouts, with open water in front', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const spot = level.fishing!;
      const jetty = level.solids.find((s) => s.id === 'jetty')!;
      const dock = level.solids.find((s) => s.id === 'dock')!;
      expect(onSpot(spot, 'jetty', spot.x, spot.z)).toBe(true);
      expect(onSpot(spot, 'dock', spot.x, spot.z)).toBe(false);
      // The jetty joins the dock, level with it, so a hero walks on.
      expect(jetty.top).toBe(dock.top);
      expect(jetty.z + jetty.halfZ).toBeCloseTo(dock.z - dock.halfZ, 5);
      // No scout's ground reaches onto it.
      for (const enemy of level.enemies ?? []) {
        if (!enemy.arena || enemy.kind !== 'marmot' || !enemy.id.startsWith('scout-dock')) continue;
        expect(enemy.arena.minZ, enemy.id).toBeGreaterThanOrEqual(jetty.z + jetty.halfZ);
      }
      // The route never crosses it: fishing is a choice.
      expect(level.route).not.toContain('jetty');
    }
  });

  it('going fishing never ends the level by accident: the golden leaf is at the dock’s far end, well off the way to the jetty', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const jetty = level.solids.find((s) => s.id === 'jetty')!;
      const dock = level.solids.find((s) => s.id === 'dock')!;
      const boardwalk = level.solids.find((s) => s.id === 'boardwalk')!;
      // The way to the jetty: off the end of the boardwalk and across the dock to the jetty's foot.
      const from = { x: boardwalk.x + boardwalk.halfX, z: boardwalk.z };
      const to = { x: jetty.x, z: jetty.z + jetty.halfZ };
      let nearest = Infinity;
      for (let t = 0; t <= 1; t += 0.02) nearest = Math.min(nearest, Math.hypot(from.x + (to.x - from.x) * t - level.leaf.x, from.z + (to.z - from.z) * t - level.leaf.z));
      expect(nearest, difficulty).toBeGreaterThan(5);
      expect(Math.hypot(jetty.x - level.leaf.x, jetty.z - level.leaf.z), difficulty).toBeGreaterThan(6);
      // And a hero who walks that way, with room to wander, does not finish the level.
      for (const wander of [-1.5, 0, 1.5]) {
        const game = new Game(level, difficulty, 'Yaarbro');
        for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
        game.startOn('boardwalk');
        const via = { x: dock.x - dock.halfX + 2 + wander, z: dock.z + wander };
        for (const goal of [via, { x: level.fishing!.x, z: level.fishing!.z }]) {
          for (let i = 0; i < 12 / STEP && Math.hypot(goal.x - game.x, goal.z - game.z) > 0.4; i += 1) {
            const far = Math.hypot(goal.x - game.x, goal.z - game.z);
            game.step({ moveX: (goal.x - game.x) / far, moveZ: (goal.z - game.z) / far, jump: false });
          }
        }
        expect(game.groundId, `${difficulty} ${wander}`).toBe('jetty');
        expect(game.complete, `${difficulty} ${wander}`).toBe(false);
      }
    }
  });

  it('off the spot the move button is the hero’s own move; on it, it fishes and the hero stands', () => {
    const level = buildLake('normal');
    const game = new Game(level, 'normal', 'Yaarbro');
    game.startOn('dock');
    game.step({ ...IDLE, move: true });
    expect(game.rolling).toBe(true);
    expect(game.fishing!.phase).toBe('off');
    game.step(IDLE);
    game.startOn('jetty');
    game.step(IDLE);
    game.step({ ...IDLE, move: true });
    expect(fishingEvents(game.events)).toEqual([{ type: 'fishing', what: 'start' }]);
    expect(game.rolling).toBe(false);
    const at = { x: game.x, z: game.z };
    // With a line out the stick aims; it does not walk the hero off the jetty.
    for (let i = 0; i < 1 / STEP; i += 1) game.step({ moveX: 1, moveZ: -1, jump: false, move: true });
    expect(game.x).toBeCloseTo(at.x, 5);
    expect(game.z).toBeCloseTo(at.z, 5);
    expect(game.fishing!.across).toBeGreaterThan(1);
    // Jump winds in rather than jumping.
    game.step({ ...IDLE, jump: true, move: true });
    expect(game.fishing!.phase).toBe('off');
    expect(game.grounded).toBe(true);
  });

  it('a hero hurt while fishing drops the line, and the hooked fish gets away', () => {
    const level = buildLake('normal');
    const game = new Game(level, 'normal', 'Caputo');
    game.startOn('jetty');
    const fisher = new Fisher('bass');
    for (let i = 0; i < 60 / STEP && game.fishing!.phase !== 'hooked'; i += 1) game.step(fisher.input(game));
    expect(game.fishing!.phase).toBe('hooked');
    expect(game.hurt(game.x, game.z + 1)).toBe(true);
    game.step(IDLE);
    expect(fishingEvents(game.events)).toEqual([{ type: 'fishing', what: 'stop' }]);
    expect(game.fishing!.phase).toBe('off');
    expect(game.catches).toEqual([]);
  });

  it('dropping a line that is not out does nothing', () => {
    expect(dropLine(newFishing(spotOn('easy')))).toEqual([]);
  });

  for (const difficulty of DIFFICULTIES) {
    for (const hero of ['Yaarbro', 'Caputo'] as HeroName[]) {
      it(`on ${difficulty} the bot, as ${hero}, catches every kind of fish`, () => {
        const level = buildLake(difficulty);
        const game = new Game(level, difficulty, hero);
        game.startOn('jetty');
        const hearts = game.hearts;
        for (const species of SPECIES) {
          const size = catchOne(game, species);
          expect(size, species).not.toBeNull();
          const [low, high] = level.fishing!.numbers.species[species].size;
          expect(size!).toBeGreaterThanOrEqual(low);
          expect(size!).toBeLessThanOrEqual(high);
        }
        // Nothing on the dock reached the jetty, and the catch is on the run's record.
        expect(game.hearts).toBe(hearts);
        expect(game.summary().fish.map((each) => each.species)).toEqual(expect.arrayContaining([...SPECIES]));
        expect(game.falls).toBe(0);
      });
    }
  }

  it('fishing takes nothing from the run, and never ends it: the leaf cannot be taken until the monster pike is beaten', () => {
    const level = buildLake('easy');
    const game = new Game(level, 'easy', 'Yaarbro');
    game.startOn('jetty');
    expect(catchOne(game, 'perch')).not.toBeNull();
    // Let the hero put the fish back, then walk to where the leaf will be, on the dock.
    for (let i = 0; i < 4 / STEP; i += 1) game.step(IDLE);
    for (let i = 0; i < 20 / STEP && !game.complete; i += 1) {
      const dx = level.leaf.x - game.x;
      const dz = level.leaf.z - game.z;
      const far = Math.hypot(dx, dz) || 1;
      game.step({ moveX: dx / far, moveZ: dz / far, jump: Math.hypot(dx, dz) < 1.2 });
    }
    expect(Math.hypot(level.leaf.x - game.x, level.leaf.z - game.z)).toBeLessThan(1.5);
    expect(game.goalOpen).toBe(false);
    expect(game.complete).toBe(false);
    expect(game.summary().fish).toEqual([{ species: 'perch', size: expect.any(Number) }]);
  });
});
