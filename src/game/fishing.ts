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
// A level's water may also hold one monster (`monster` in the numbers; see
// pike.ts): a far bigger shadow that swims a circle of its own. A lure near
// it hooks it like any fish, and the tug of war is the same, but it is never
// landed: each stretch of line reeled in takes one of its pips, and when the
// last of them goes it drags the hero off the spot (`dragged`). If the line
// snaps or it gets away, its pips are back (`escaped`).
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

/** The monster in the water, if the level has one (see pike.ts). Distances are metres from the spot. */
export interface MonsterNumbers {
  /** Where the middle of the circle it swims is, and how wide the circle. */
  home: { out: number; across: number };
  circle: number;
  /** How fast it swims its circle, in metres a second. */
  cruise: number;
  /** Nose to tail, in centimetres. */
  size: number;
  /** Pips the tug of war takes, and how much line is still out when the last one goes and it drags the hero in. */
  pips: number;
  dragAt: number;
  /** Seconds it tires for between thrashes, seconds a thrash lasts, and how fast it takes line in one. */
  calm: number;
  thrash: number;
  run: number;
  /** With cast help (Easy): the ring goes to the monster when it is no further from it than this many times as far as the nearest fish. */
  pull: number;
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
  /** The monster, where the level has one. */
  monster?: MonsterNumbers;
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

export type FishMood = 'idle' | 'coming' | 'nibbling' | 'biting' | 'hooked' | 'fleeing' | 'landed';

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
  /** True for the level's monster: it swims its own circle, and is dragged against, never landed. */
  monster?: true;
}

export type FishingPhase = 'off' | 'aim' | 'cast' | 'wait' | 'bite' | 'hooked' | 'show' | 'lost';

export type FishingEvent =
  | { what: 'start' | 'stop' | 'cast' | 'plop' | 'scared' | 'missed' | 'snapped' | 'away' }
  | { what: 'nibble' | 'bite' | 'hooked' | 'tell' | 'thrash' | 'calm'; species: Species; monster?: true }
  /** The monster: the tug of war took a pip (`left` of the tug's are still to go), it dragged the hero in, or it got off the line. */
  | { what: 'pip'; left: number }
  | { what: 'dragged' | 'escaped' }
  | { what: 'landed'; species: Species; size: number };

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
  /** The monster's pips the tug of war has taken so far, and how much line was out when it was hooked. */
  pips: number;
  hookedAt: number;
  /** The fish being held up. */
  shown: Catch | null;
  /** Whether the button was held on the last step. */
  held: boolean;
  jumpHeld: boolean;
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
    line: 0, strain: 0, fight: 'calm', fightFor: 0, reeling: false, pips: 0, hookedAt: 0, shown: null, held: false, jumpHeld: false, seed, nextId: 1,
  };
  for (const species of SPECIES) for (let i = 0; i < spot.numbers.species[species].count; i += 1) state.fish.push(stock(state, spot, species));
  stockMonster(state, spot);
  return state;
};

/** The monster in the water, if it is there. */
export const monsterOf = (state: FishingState): Fish | null => state.fish.find((fish) => fish.monster) ?? null;

/** Where the monster is on its circle, `loop` of the way round. */
const onCircle = (m: MonsterNumbers, loop: number): { out: number; across: number } => ({
  out: m.home.out + m.circle * Math.sin(loop * Math.PI * 2),
  across: m.home.across + m.circle * Math.cos(loop * Math.PI * 2),
});

/** Puts the level's monster back in its water, swimming its circle, if it is not there. Nothing where the level has none. */
export const stockMonster = (state: FishingState, spot: FishingSpot): void => {
  const m = spot.numbers.monster;
  if (!m || monsterOf(state)) return;
  const at = onCircle(m, 0);
  state.fish.push({ id: state.nextId, species: 'pike', size: m.size, out: at.out, across: at.across, heading: 0, mood: 'idle', home: { ...m.home }, loop: 0, wait: 0, monster: true });
  state.nextId += 1;
};

/** Takes the monster out of the fishing water: the fight has moved on, or is won. A line it was on is let go. */
export const removeMonster = (state: FishingState): void => {
  const monster = monsterOf(state);
  if (!monster) return;
  if (state.taker === monster.id) state.taker = null;
  state.fish.splice(state.fish.indexOf(monster), 1);
};

/** True when a hero standing at (x, z) on the solid `groundId` is on the spot. */
export const onSpot = (spot: FishingSpot, groundId: string | null, x: number, z: number): boolean =>
  groundId === spot.solid && Math.hypot(x - spot.x, z - spot.z) <= spot.radius;

/** Where a point `out` metres out and `across` to the right is in the level. */
export const fishingPoint = (spot: FishingSpot, out: number, across: number): { x: number; z: number } => ({
  x: spot.x + spot.ahead.x * out - spot.ahead.z * across,
  z: spot.z + spot.ahead.z * out + spot.ahead.x * across,
});

/** How much of its size range a fish fills: 0 the smallest of its kind, 1 the biggest. */
export const bigness = (spot: FishingSpot, fish: Pick<Fish, 'species' | 'size' | 'monster'>): number => {
  if (fish.monster) return 1;
  const [low, high] = spot.numbers.species[fish.species].size;
  return Math.max(0, Math.min(1, (fish.size - low) / Math.max(1, high - low)));
};

/** What a fish on the line is like: its kind's numbers, or the monster's. */
const kindOf = (n: FishingNumbers, fish: Fish): { calm: number; thrash: number; run: number } => (fish.monster && n.monster ? n.monster : n.species[fish.species]);

/** Marks an event as the monster's. */
const tagged = <T extends object>(event: T, fish: Fish): T => (fish.monster ? { ...event, monster: true as const } : event);

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
    if (fish.mood !== 'idle') continue;
    const m = spot.numbers.monster;
    if (fish.monster && m) {
      // Round and round its circle, getting back onto it first if it has been away.
      const along = onCircle(m, fish.loop);
      if (swimTo(fish, along.out, along.across, m.cruise * 1.6, dt) || Math.hypot(along.out - fish.out, along.across - fish.across) < 0.5) fish.loop = (fish.loop + (m.cruise * dt) / (Math.PI * 2 * m.circle)) % 1;
      continue;
    }
    // A slow figure of eight round home, each fish at its own place in it.
    fish.loop = (fish.loop + dt / 14) % 1;
    const angle = fish.loop * Math.PI * 2;
    swimTo(fish, fish.home.out + 1.2 * Math.sin(angle), fish.home.across + 1.8 * Math.sin(angle * 2) * 0.5 + 0.9 * Math.cos(angle), 0.7, dt);
  }
};

const scare = (state: FishingState, fish: Fish, events?: FishingEvent[]): void => {
  // The monster off the line: every pip the tug of war took is back.
  if (fish.monster && fish.mood === 'hooked') {
    state.pips = 0;
    events?.push({ what: 'escaped' });
  }
  fish.mood = 'fleeing';
  fish.wait = FISHING.sulk;
  if (state.taker === fish.id) state.taker = null;
};

const stop = (state: FishingState, events: FishingEvent[]): void => {
  const fish = takerOf(state);
  if (fish && fish.mood !== 'landed') scare(state, fish, events);
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
          // The monster counts as nearer than it is, so a ring anywhere about it goes to it.
          const far = (each: Fish): number => Math.hypot(each.out - state.out, each.across - state.across) / (each.monster ? n.monster?.pull ?? 1 : 1);
          if (!nearest || far(fish) < far(nearest)) nearest = fish;
        }
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
        const [least, most] = fish.monster ? [0, 0] : n.species[fish.species].nibbles;
        state.nibbles = least + Math.floor(chance(state) * (most - least + 1)) + (most > 0 ? n.moreNibbles : 0);
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
      events.push(tagged({ what: 'bite', species: fish.species }, fish));
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
        state.hookedAt = state.line;
        state.pips = 0;
        state.strain = 0;
        state.fight = 'calm';
        state.fightFor = kindOf(n, fish).calm * (0.7 + 0.3 * chance(state));
        events.push(tagged({ what: 'hooked', species: fish.species }, fish));
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
      const kind = kindOf(n, fish);
      state.reeling = input.button;
      state.fightFor -= dt;
      if (state.fightFor <= 0) {
        if (state.fight === 'calm') {
          state.fight = 'tell';
          state.fightFor = n.tell;
          events.push(tagged({ what: 'tell', species: fish.species }, fish));
        } else if (state.fight === 'tell') {
          state.fight = 'thrash';
          state.fightFor = kind.thrash * (0.7 + 0.7 * bigness(spot, fish));
          events.push(tagged({ what: 'thrash', species: fish.species }, fish));
        } else {
          state.fight = 'calm';
          state.fightFor = kind.calm * (0.8 + 0.4 * chance(state));
          events.push(tagged({ what: 'calm', species: fish.species }, fish));
        }
      }
      if (state.fight === 'thrash') {
        if (state.reeling && n.snap !== Infinity) state.strain += dt / n.snap;
        else state.strain = Math.max(0, state.strain - FISHING.ease * dt);
        // It only takes line where a line can snap: on Easy a thrash just holds.
        if (!state.reeling && n.snap !== Infinity) state.line += kind.run * dt;
      } else {
        state.strain = Math.max(0, state.strain - FISHING.ease * dt);
        if (state.reeling) state.line -= n.reel * dt;
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
      // The monster: each stretch of line reeled in takes a pip, and with the last of the tug's it drags the hero in.
      const m = fish.monster ? n.monster : undefined;
      if (m) {
        const each = Math.max(0.1, state.hookedAt - m.dragAt) / m.pips;
        while (state.pips < m.pips && state.line <= state.hookedAt - each * (state.pips + 1) + 1e-9) {
          state.pips += 1;
          events.push({ what: 'pip', left: m.pips - state.pips });
        }
      }
      if (state.strain >= 1) {
        scare(state, fish, events);
        state.phase = 'lost';
        state.timer = 0;
        state.strain = 0;
        state.reeling = false;
        events.push({ what: 'snapped' });
      } else if (state.line >= spot.far + FISHING.spare) {
        scare(state, fish, events);
        state.phase = 'lost';
        state.timer = 0;
        state.reeling = false;
        events.push({ what: 'away' });
      } else if (m && state.pips >= m.pips) {
        // Dragged in: the line is gone with the monster, and the fight moves to the water (pike.ts).
        removeMonster(state);
        state.phase = 'off';
        state.timer = 0;
        state.strain = 0;
        state.reeling = false;
        events.push({ what: 'dragged' });
      } else if (!m && state.line <= FISHING.landAt) {
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
