// Fishing, which any level can have: a spot to stand on beside water with
// fish in it. One button does it all, with the stick to aim.
//
//   1. Standing on the spot, hold the move button: a ring slides out over the
//      water and back. The stick moves it left and right. Let go, and the lure
//      lands where the ring is.
//   2. The bobber floats. A fish near enough comes over. It may nibble (the
//      bobber twitches: wait), then it bites (the bobber goes under): press
//      the button while the bite lasts to hook it.
//   3. Reeling is a tug of war. Hold the button to reel while the fish tires.
//      When it thrashes, let go and let the line run: reeling through a thrash
//      strains the line, and a line strained too long snaps.
//   4. Reeled all the way in, the fish is landed: it counts for the run, and
//      goes back in the lake.
//
// Jump stops fishing at any point before a fish is hooked, and nothing is
// ever lost by a bad cast. On Easy nothing needs timing: the cast lands
// beside the nearest fish, a fish hooks itself and the line cannot snap (the
// numbers are the level's, in its `difficulty.ts`).
//
// No drawing here and no browser code. `game.ts` steps it while the hero
// stands on the spot; `docs/adding-a-level.md` says how to give a level one.

export type Species = 'perch' | 'bass' | 'trout' | 'pike';
export const SPECIES: readonly Species[] = ['perch', 'bass', 'trout', 'pike'];

/** What one kind of fish is like. Distances are metres out from the spot; sizes are centimetres. */
export interface SpeciesNumbers {
  /** How many of them are in the water at once. */
  count: number;
  /** The water they keep to: from this far out to this far out. */
  zone: [number, number];
  /** The smallest and biggest one can be, nose to tail. */
  size: [number, number];
  /** How many times it nibbles before it bites: at least, and at most. */
  nibbles: [number, number];
  /** Seconds it tires for between thrashes, and seconds a thrash lasts, for a middling one. A bigger one thrashes longer. */
  calm: number;
  thrash: number;
  /** How fast it takes line while it thrashes, in metres a second. */
  run: number;
}

/** What a difficulty changes. */
export interface FishingNumbers {
  /** True when a cast lands beside the nearest fish wherever the ring is (Easy). */
  castHelp: boolean;
  /** How fast the ring slides out and back while the button is held, in metres a second. */
  sweep: number;
  /** How near a fish the lure must land for the fish to come, in metres. */
  notice: number;
  /** A lure landing this near a shy fish (the trout) scares it off. 0 for never. */
  spook: number;
  /** Seconds a bite lasts. Infinity: the fish hooks itself and waits. */
  biteWindow: number;
  /** Nibbles added to every fish's own. */
  moreNibbles: number;
  /** True when pressing on a nibble scares the fish off. */
  nibbleScares: boolean;
  /** Seconds of reeling through a thrash before the line snaps. Infinity for never. */
  snap: number;
  /** Seconds of warning before a thrash: the fish shudders and splashes. */
  tell: number;
  /** How fast a fish that is not being reeled takes line back while it tires, in metres a second. */
  drift: number;
  /** How fast the line comes in while reeling, in metres a second. */
  reel: number;
  species: Record<Species, SpeciesNumbers>;
}

/** A fishing spot, as a level lays it. */
export interface FishingSpot {
  id: string;
  /** The solid to stand on, and where on it: within `radius` of (x, z). */
  solid: string;
  x: number;
  z: number;
  radius: number;
  /** Which way the water lies from the spot: a step of length 1 seen from above. */
  ahead: { x: number; z: number };
  /** How high the water stands. */
  surface: number;
  /** How near and how far a cast can land, and how far to either side. */
  near: number;
  far: number;
  halfWidth: number;
  numbers: FishingNumbers;
}

export const FISHING = {
  /** Seconds a cast spends in the air. */
  castTime: 0.55,
  /** How fast the stick moves the ring sideways, in metres a second. */
  aimSpeed: 5,
  /** How fast a fish swims to a lure, and away when scared, in metres a second. */
  approach: 2.2,
  flee: 4.5,
  /** Seconds between nibbles, and from the last nibble to the bite. */
  nibbleGap: 0.75,
  /** Seconds a scared fish takes no interest in anything. */
  sulk: 5,
  /** How far from the spot a fish is landed: the line is in. */
  landAt: 1.6,
  /** Line a fish can take past the far end of the water before it is gone. */
  spare: 8,
  /** How fast the strain on the line eases when it is not being reeled through a thrash, in shares of the whole a second. */
  ease: 0.9,
  /** Seconds a landed fish is held up before the hero can do anything else, and at most. */
  showFirst: 1.6,
  show: 2.6,
  /** Seconds after a line snaps or a fish gets away before the next cast. */
  rue: 0.9,
  /** Seconds after it is landed before another fish of its kind is in the water. */
  restock: 4,
  /** How far below the surface fish swim. */
  depth: 0.45,
} as const;

export type FishMood = 'idle' | 'coming' | 'nibbling' | 'biting' | 'hooked' | 'fleeing' | 'landed' | 'fighting';

/**
 * A monster on the line (the lake's monster pike: see pike.ts). It is fished
 * for like any fish, but it is never landed: every `pull` metres of line won
 * takes one of its `pips`, and when they are gone it drags the hero in.
 */
export interface MonsterNumbers {
  pips: number;
  pull: number;
  /** Seconds it tires for between thrashes, seconds a thrash lasts, and how fast it takes line while it thrashes. */
  calm: number;
  thrash: number;
  run: number;
  /** How much of the usual reeling speed its weight leaves: under 1, it comes in slowly. */
  heavy: number;
}

/** The id of the monster among the fish, and how long it is in centimetres. */
export const MONSTER_ID = 0;
export const MONSTER_SIZE = 330;
/** With help (Easy), a cast whose ring is within this far of the monster lands beside it. */
const MONSTER_HELP = 5;

/** One fish in the water. `out` and `across` are metres from the spot, along `ahead` and to its right. */
export interface Fish {
  id: number;
  species: Species;
  /** Centimetres, nose to tail. */
  size: number;
  out: number;
  across: number;
  /** Which way it faces, in radians from `ahead`, turning to the right. */
  heading: number;
  mood: FishMood;
  /** The middle of the patch it idles in, and where in its idle loop it is. */
  home: { out: number; across: number };
  loop: number;
  /** Seconds it has left to sulk, or (landed) until another takes its place. */
  wait: number;
  /** True for the monster: the game moves it while it is idle (it circles its log), and it is never landed. */
  monster?: boolean;
}

export type FishingPhase = 'off' | 'aim' | 'cast' | 'wait' | 'bite' | 'hooked' | 'show' | 'lost';

export type FishingEvent =
  | { what: 'start' | 'stop' | 'cast' | 'plop' | 'scared' | 'missed' | 'snapped' | 'away' }
  | { what: 'nibble' | 'bite' | 'hooked' | 'tell' | 'thrash' | 'calm'; species: Species }
  | { what: 'landed'; species: Species; size: number }
  /** The monster lost a pip on the line (`left` still to go on the line), or lost its last one there and drags the hero in. */
  | { what: 'pip'; left: number }
  | { what: 'dragged' };

/** A fish that has been landed this run. */
export interface Catch {
  species: Species;
  size: number;
}

export interface FishingState {
  phase: FishingPhase;
  /** Seconds in this phase. */
  timer: number;
  /** Where the ring is while aiming, then where the lure is. */
  out: number;
  across: number;
  /** Which way the ring is sliding: 1 out, -1 back. */
  sliding: 1 | -1;
  fish: Fish[];
  /** The fish that is at the lure or on the line, by id. */
  taker: number | null;
  /** Nibbles still to come before the bite, and seconds to the next one. */
  nibbles: number;
  next: number;
  /** On the line: metres of line out, how strained it is (0 to 1), and what the fish is doing. */
  line: number;
  strain: number;
  fight: 'calm' | 'tell' | 'thrash';
  fightFor: number;
  /** True while the button reels. */
  reeling: boolean;
  /** The fish being held up. */
  shown: Catch | null;
  /** Whether the button was held on the last step. */
  held: boolean;
  jumpHeld: boolean;
  /** The monster's numbers while there is one in the water, how many pips it has left on the line, and the line length that takes the next. */
  monster: MonsterNumbers | null;
  pips: number;
  pipAt: number;
  /** The source of every chance here: the same run always meets the same fish. */
  seed: number;
  nextId: number;
}

/** A number from 0 up to 1, the next in the state's own sequence. */
const chance = (state: FishingState): number => {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const between = (state: FishingState, [low, high]: readonly [number, number]): number => low + (high - low) * chance(state);

/** Puts a new fish of a kind in its water. */
const stock = (state: FishingState, spot: FishingSpot, species: Species): Fish => {
  const numbers = spot.numbers.species[species];
  const home = { out: between(state, numbers.zone), across: between(state, [-spot.halfWidth * 0.8, spot.halfWidth * 0.8]) };
  const fish: Fish = {
    id: state.nextId,
    species,
    // Most are middling; a big one is rare.
    size: Math.round(numbers.size[0] + (numbers.size[1] - numbers.size[0]) * chance(state) ** 1.7),
    out: home.out,
    across: home.across,
    heading: between(state, [0, Math.PI * 2]),
    mood: 'idle',
    home,
    loop: between(state, [0, 1]),
    wait: 0,
  };
  state.nextId += 1;
  return fish;
};

export const newFishing = (spot: FishingSpot, seed = 20261119): FishingState => {
  const state: FishingState = {
    phase: 'off', timer: 0, out: spot.near, across: 0, sliding: 1, fish: [], taker: null, nibbles: 0, next: 0,
    line: 0, strain: 0, fight: 'calm', fightFor: 0, reeling: false, shown: null, held: false, jumpHeld: false, monster: null, pips: 0, pipAt: 0, seed, nextId: 1,
  };
  for (const species of SPECIES) for (let i = 0; i < spot.numbers.species[species].count; i += 1) state.fish.push(stock(state, spot, species));
  return state;
};

/** Puts the monster in the water at (out, across), to be fished for; or takes it out again (`numbers` null). */
export const setMonster = (state: FishingState, numbers: MonsterNumbers | null, out = 0, across = 0): void => {
  state.fish = state.fish.filter((fish) => !fish.monster);
  if (state.taker === MONSTER_ID) state.taker = null;
  state.monster = numbers;
  if (!numbers) return;
  state.fish.push({ id: MONSTER_ID, species: 'pike', size: MONSTER_SIZE, out, across, heading: 0, mood: 'idle', home: { out, across }, loop: 0, wait: 0, monster: true });
};

/** The monster among the fish, if it is in the water. */
export const monsterOf = (state: FishingState): Fish | null => state.fish.find((fish) => fish.monster) ?? null;

/** True when a hero standing at (x, z) on the solid `groundId` is on the spot. */
export const onSpot = (spot: FishingSpot, groundId: string | null, x: number, z: number): boolean =>
  groundId === spot.solid && Math.hypot(x - spot.x, z - spot.z) <= spot.radius;

/** Where a point `out` metres out and `across` to the right is in the level. */
export const fishingPoint = (spot: FishingSpot, out: number, across: number): { x: number; z: number } => ({
  x: spot.x + spot.ahead.x * out - spot.ahead.z * across,
  z: spot.z + spot.ahead.z * out + spot.ahead.x * across,
});

/** How much of its size range a fish fills: 0 the smallest of its kind, 1 the biggest. */
export const bigness = (spot: FishingSpot, fish: Pick<Fish, 'species' | 'size'>): number => {
  const [low, high] = spot.numbers.species[fish.species].size;
  return Math.max(0, Math.min(1, (fish.size - low) / Math.max(1, high - low)));
};

const takerOf = (state: FishingState): Fish | null => state.fish.find((fish) => fish.id === state.taker) ?? null;

/** Swims a fish toward a point at a speed. True when it is there. */
const swimTo = (fish: Fish, out: number, across: number, speed: number, dt: number): boolean => {
  const far = Math.hypot(out - fish.out, across - fish.across);
  if (far > 1e-3) fish.heading = Math.atan2(across - fish.across, out - fish.out);
  if (far <= speed * dt) {
    fish.out = out;
    fish.across = across;
    return true;
  }
  fish.out += ((out - fish.out) / far) * speed * dt;
  fish.across += ((across - fish.across) / far) * speed * dt;
  return false;
};

/** The fish go about their own business: idling round home, sulking, and being replaced once landed. */
const stepFish = (state: FishingState, spot: FishingSpot, dt: number): void => {
  for (let i = 0; i < state.fish.length; i += 1) {
    const fish = state.fish[i];
    if (fish.mood === 'landed') {
      fish.wait -= dt;
      if (fish.wait <= 0) state.fish[i] = stock(state, spot, fish.species);
      continue;
    }
    if (fish.mood === 'fleeing') {
      fish.wait -= dt;
      const there = swimTo(fish, fish.home.out, fish.home.across, FISHING.flee, dt);
      if (there && fish.wait <= 0) fish.mood = 'idle';
      continue;
    }
    // The monster circles its log: the game moves it.
    if (fish.mood !== 'idle' || fish.monster) continue;
    // A slow figure of eight round home, each fish at its own place in it.
    fish.loop = (fish.loop + dt / 14) % 1;
    const angle = fish.loop * Math.PI * 2;
    swimTo(fish, fish.home.out + 1.2 * Math.sin(angle), fish.home.across + 1.8 * Math.sin(angle * 2) * 0.5 + 0.9 * Math.cos(angle), 0.7, dt);
  }
};

const scare = (state: FishingState, fish: Fish): void => {
  // The monster does not flee: it goes back to circling its log.
  fish.mood = fish.monster ? 'idle' : 'fleeing';
  fish.wait = FISHING.sulk;
  if (state.taker === fish.id) state.taker = null;
};

const stop = (state: FishingState, events: FishingEvent[]): void => {
  const fish = takerOf(state);
  if (fish && fish.mood !== 'landed') scare(state, fish);
  state.phase = 'off';
  state.timer = 0;
  state.taker = null;
  state.strain = 0;
  state.reeling = false;
  state.shown = null;
  events.push({ what: 'stop' });
};

/** Ends fishing at once, whatever was happening: the hero was hurt, or left the spot. A hooked fish gets away. */
export const dropLine = (state: FishingState): FishingEvent[] => {
  const events: FishingEvent[] = [];
  if (state.phase !== 'off') stop(state, events);
  return events;
};

/** The nearest fish that would come to a lure at (out, across), if any. */
const fishFor = (state: FishingState, spot: FishingSpot, out: number, across: number): Fish | null => {
  let best: Fish | null = null;
  let nearest = spot.numbers.notice;
  for (const fish of state.fish) {
    if (fish.mood !== 'idle') continue;
    const far = Math.hypot(fish.out - out, fish.across - across);
    // The monster takes a lure in its reach before any other fish dares.
    if (fish.monster && far <= spot.numbers.notice) return fish;
    if (far <= nearest) {
      best = fish;
      nearest = far;
    }
  }
  return best;
};

export interface FishingInput {
  /** The move button, and Jump. */
  button: boolean;
  jump: boolean;
  /** The stick, to the right of `ahead` (-1 to 1). */
  across: number;
}

/**
 * Advances fishing by one step. `standing` is whether the hero is on the
 * spot and free to fish. Returns what happened; `landed` is the catch.
 */
export const stepFishing = (state: FishingState, spot: FishingSpot, input: FishingInput, standing: boolean, dt: number): FishingEvent[] => {
  const events: FishingEvent[] = [];
  const n = spot.numbers;
  const pressed = input.button && !state.held;
  const released = !input.button && state.held;
  const jumped = input.jump && !state.jumpHeld;
  state.held = input.button;
  state.jumpHeld = input.jump;
  stepFish(state, spot, dt);
  state.timer += dt;

  if (state.phase !== 'off' && !standing) {
    stop(state, events);
    return events;
  }

  switch (state.phase) {
    case 'off': {
      if (!standing || !pressed) break;
      state.phase = 'aim';
      state.timer = 0;
      state.out = spot.near;
      state.across = 0;
      state.sliding = 1;
      events.push({ what: 'start' });
      break;
    }
    case 'aim': {
      if (jumped) {
        stop(state, events);
        break;
      }
      if (input.button && !released) {
        state.out += state.sliding * n.sweep * dt;
        if (state.out >= spot.far) {
          state.out = spot.far;
          state.sliding = -1;
        } else if (state.out <= spot.near) {
          state.out = spot.near;
          state.sliding = 1;
        }
        state.across = Math.max(-spot.halfWidth, Math.min(spot.halfWidth, state.across + input.across * FISHING.aimSpeed * dt));
        break;
      }
      // Let go: the lure flies. With help it lands beside the fish nearest the ring.
      if (n.castHelp) {
        let nearest: Fish | null = null;
        for (const fish of state.fish) {
          if (fish.mood !== 'idle') continue;
          if (!nearest || Math.hypot(fish.out - state.out, fish.across - state.across) < Math.hypot(nearest.out - state.out, nearest.across - state.across)) nearest = fish;
        }
        // A cast anywhere near the monster's shadow is a cast at the monster.
        const monster = monsterOf(state);
        if (monster && monster.mood === 'idle' && Math.hypot(monster.out - state.out, monster.across - state.across) <= MONSTER_HELP) nearest = monster;
        if (nearest) {
          state.out = Math.max(spot.near, Math.min(spot.far, nearest.out - 0.6));
          state.across = nearest.across;
        }
      }
      state.phase = 'cast';
      state.timer = 0;
      events.push({ what: 'cast' });
      break;
    }
    case 'cast': {
      if (state.timer < FISHING.castTime) break;
      state.phase = 'wait';
      state.timer = 0;
      state.taker = null;
      events.push({ what: 'plop' });
      // A lure dropped on a shy fish's head scares it.
      if (n.spook > 0) {
        for (const fish of state.fish) {
          if (fish.species === 'trout' && fish.mood === 'idle' && Math.hypot(fish.out - state.out, fish.across - state.across) < n.spook) {
            scare(state, fish);
            events.push({ what: 'scared' });
          }
        }
      }
      break;
    }
    case 'wait': {
      if (jumped) {
        stop(state, events);
        break;
      }
      let fish = takerOf(state);
      if (!fish) {
        fish = fishFor(state, spot, state.out, state.across);
        if (!fish) break;
        state.taker = fish.id;
        fish.mood = 'coming';
      }
      if (fish.mood === 'coming') {
        if (!swimTo(fish, state.out, state.across, FISHING.approach, dt)) break;
        fish.mood = 'nibbling';
        const [least, most] = n.species[fish.species].nibbles;
        // The monster never nibbles: it takes the lure whole.
        state.nibbles = fish.monster ? 0 : least + Math.floor(chance(state) * (most - least + 1)) + (most > 0 ? n.moreNibbles : 0);
        state.next = FISHING.nibbleGap * 0.6;
        break;
      }
      // Nibbling: pressing now does nothing, or on Hard scares it.
      if (pressed && n.nibbleScares) {
        scare(state, fish);
        events.push({ what: 'scared' });
        break;
      }
      state.next -= dt;
      if (state.next > 0) break;
      if (state.nibbles > 0) {
        state.nibbles -= 1;
        state.next = FISHING.nibbleGap;
        events.push({ what: 'nibble', species: fish.species });
        break;
      }
      fish.mood = 'biting';
      state.phase = 'bite';
      state.timer = 0;
      events.push({ what: 'bite', species: fish.species });
      break;
    }
    case 'bite': {
      const fish = takerOf(state);
      if (!fish) {
        state.phase = 'wait';
        break;
      }
      // Without a limit the fish has hooked itself: any press, now or later, starts the reel.
      const hooks = pressed || (input.button && n.biteWindow === Infinity);
      if (hooks) {
        fish.mood = 'hooked';
        state.phase = 'hooked';
        state.timer = 0;
        state.line = Math.hypot(fish.out, fish.across);
        state.strain = 0;
        state.fight = 'calm';
        state.fightFor = (fish.monster && state.monster ? state.monster.calm : n.species[fish.species].calm) * (0.7 + 0.3 * chance(state));
        if (fish.monster && state.monster) {
          // Each pip is `pull` metres of line won, and the last is won well short of the spot.
          state.pips = state.monster.pips;
          state.pipAt = state.line - Math.min(state.monster.pull, (state.line - FISHING.landAt - 1.5) / state.pips);
        }
        events.push({ what: 'hooked', species: fish.species });
        break;
      }
      if (jumped && n.biteWindow === Infinity) {
        stop(state, events);
        break;
      }
      if (state.timer >= n.biteWindow) {
        scare(state, fish);
        state.phase = 'wait';
        state.timer = 0;
        events.push({ what: 'missed' });
      }
      break;
    }
    case 'hooked': {
      const fish = takerOf(state);
      if (!fish) {
        state.phase = 'off';
        break;
      }
      const monster = fish.monster ? state.monster : null;
      const kind = monster ?? n.species[fish.species];
      state.reeling = input.button;
      state.fightFor -= dt;
      if (state.fightFor <= 0) {
        if (state.fight === 'calm') {
          state.fight = 'tell';
          state.fightFor = n.tell;
          events.push({ what: 'tell', species: fish.species });
        } else if (state.fight === 'tell') {
          state.fight = 'thrash';
          state.fightFor = monster ? monster.thrash : kind.thrash * (0.7 + 0.7 * bigness(spot, fish));
          events.push({ what: 'thrash', species: fish.species });
        } else {
          state.fight = 'calm';
          state.fightFor = kind.calm * (0.8 + 0.4 * chance(state));
          events.push({ what: 'calm', species: fish.species });
        }
      }
      if (state.fight === 'thrash') {
        if (state.reeling && n.snap !== Infinity) state.strain += dt / n.snap;
        else state.strain = Math.max(0, state.strain - FISHING.ease * dt);
        // It only takes line where a line can snap: on Easy a thrash just holds.
        if (!state.reeling && n.snap !== Infinity) state.line += kind.run * dt;
      } else {
        state.strain = Math.max(0, state.strain - FISHING.ease * dt);
        if (state.reeling) state.line -= n.reel * (monster ? monster.heavy : 1) * dt;
        else state.line += n.drift * dt;
      }
      // The fish is at the end of the line, weaving a little as it comes.
      const bearing = Math.atan2(fish.across, Math.max(0.1, fish.out));
      const weave = bearing + (state.fight === 'thrash' ? 0.5 : 0.15) * Math.sin(state.timer * (state.fight === 'thrash' ? 9 : 2.2)) * dt;
      fish.out = Math.cos(weave) * state.line;
      fish.across = Math.sin(weave) * state.line;
      fish.heading = state.fight === 'thrash' ? weave + Math.sin(state.timer * 14) * 1.2 : weave + Math.PI;
      state.out = fish.out;
      state.across = fish.across;
      if (state.strain >= 1) {
        scare(state, fish);
        state.phase = 'lost';
        state.timer = 0;
        state.strain = 0;
        state.reeling = false;
        events.push({ what: 'snapped' });
      } else if (monster && state.line <= state.pipAt) {
        // A pip: and with the last one on the line it drags the hero in.
        state.pips -= 1;
        state.pipAt -= Math.min(monster.pull, (state.pipAt - FISHING.landAt - 1.5) / Math.max(1, state.pips));
        events.push({ what: 'pip', left: state.pips });
        if (state.pips <= 0) {
          fish.mood = 'fighting';
          state.phase = 'off';
          state.timer = 0;
          state.taker = null;
          state.strain = 0;
          state.reeling = false;
          events.push({ what: 'dragged' });
        }
      } else if (state.line >= spot.far + FISHING.spare) {
        scare(state, fish);
        state.phase = 'lost';
        state.timer = 0;
        state.reeling = false;
        events.push({ what: 'away' });
      } else if (!monster && state.line <= FISHING.landAt) {
        fish.mood = 'landed';
        fish.wait = FISHING.restock;
        state.shown = { species: fish.species, size: fish.size };
        state.phase = 'show';
        state.timer = 0;
        state.taker = null;
        state.reeling = false;
        events.push({ what: 'landed', species: fish.species, size: fish.size });
      }
      break;
    }
    case 'show': {
      if (state.timer >= FISHING.show || (state.timer >= FISHING.showFirst && (pressed || jumped))) {
        state.phase = 'off';
        state.timer = 0;
        state.shown = null;
        events.push({ what: 'stop' });
      }
      break;
    }
    case 'lost': {
      if (state.timer >= FISHING.rue) {
        state.phase = 'off';
        state.timer = 0;
        events.push({ what: 'stop' });
      }
      break;
    }
  }
  return events;
};
