// Pieces that move: solids that tip, crumble or sway, and carry a hero standing
// on them. Game rules only: nothing here draws anything. Any level can use
// them: give a solid a `motion` (see `Motion` below) and the rules do the rest.
//
//   tip       A log balanced on a snag at its middle, running along the route.
//             A moment after a hero lands it wobbles (the tell), then the end
//             the hero stands on sinks, further the further out the hero
//             stands, up to `dip` metres at the very end. With nobody on it,
//             it settles back level.
//   crumble   Moss that gives way. The moment a hero lands it shivers and
//             sheds crumbs (the tell), and `tell` seconds later it either
//             falls into the mist (`falls`) and grows back `back` seconds
//             after that, or (`falls: false`, Easy) only sags `sag` metres and
//             holds, rising back once the hero has left.
//   sway      A bough that rises and sinks in the wind on a fixed rhythm: it
//             rests low, rises `rise` metres, rests high, sinks back. The last
//             `tell` seconds of each rest are the tell (a gust, its needles
//             shiver). `start` is how far into its rhythm it is when a run
//             begins, so boughs in a row can take turns.
//
//   float     A crocodile stepping stone: a crocodile's back. It lies low,
//             under the water and not there to stand on, until a hero comes
//             within `wake` metres; then it comes up (`rise` seconds). From
//             the moment a hero first lands on it, it holds for `hold`
//             seconds, hero or no hero, then goes under again; the last
//             `tell` seconds of that are its warning. With `snap`, one a hero
//             is still on when its hold runs out snaps: a heart. It comes up
//             again `down` seconds later if a hero is near. A swimmer cannot
//             climb onto one. With `hold` left at Infinity it never goes
//             under while anyone is about (Easy).
//
// Where a hero can stand is always where the piece is now: its top moves, or
// tilts, and `topAt` in level.ts gives the height at any point. The drawing
// reads the same numbers every frame, so its edge and the rules' edge agree.
//
// When a hero is sent back to a safe bank, tipping and crumbling pieces are
// put back as they started. Swaying ones keep their rhythm, which is the wind's.

import type { Solid } from './level';

export type Motion =
  | { kind: 'tip'; tell: number; dip: number; rate: number }
  | { kind: 'crumble'; tell: number; falls: boolean; sag: number; back: number }
  | { kind: 'sway'; rise: number; rest: number; move: number; tell: number; start: number }
  | { kind: 'float'; wake: number; rise: number; hold: number; tell: number; snap: boolean; down: number };

export type PiecePhase =
  /** tip: level or settling back; crumble: whole; sway: resting low. */
  | 'rest'
  /** tip and crumble: the tell after a hero lands. */
  | 'tell'
  /** tip: tipping under the hero. */
  | 'tip'
  /** crumble (Easy): sagging, and holding. */
  | 'sag'
  /** crumble: falling into the mist. */
  | 'fall'
  /** crumble: fallen, not there to stand on, until it grows back. */
  | 'gone'
  /** sway: rising, resting high, sinking. */
  | 'rise'
  | 'high'
  | 'sink';

/** A moving piece as it is now. Each Game keeps its own copy of the level's moving solids. */
export interface Piece {
  phase: PiecePhase;
  /** Seconds in this phase (sway: seconds into its whole rhythm). */
  clock: number;
  /** Where its top was when the level was built. */
  baseTop: number;
  /** Its thickness, top to underside. */
  thickness: number;
  /** tip: how far the far end is below the middle, in metres; negative when the near end is down. */
  dip: number;
  /** crumble: how fast it is falling. */
  speed: number;
  /** sway: in the tell before its next move. */
  telling: boolean;
}

/** Something a moving piece began, for sounds and drawing. */
export interface PieceEvent {
  id: string;
  kind: Motion['kind'];
  /** The tell began; it began to move; it fell away; it came back; a crocodile stood on too long snapped. */
  what: 'tell' | 'move' | 'fall' | 'back' | 'snap';
}

/** A crocodile stepping stone lying low is this far under where its back floats, and takes this long to go under. */
export const FLOAT_LOW = 0.75;
const FLOAT_SINK = 0.5;
/** Left alone this long with no hero near, a crocodile that has come up goes back under. */
const FLOAT_BORED = 4;
/** A clock value that means "long ago": a crocodile lying low from the start comes up as soon as a hero is near. */
const LONG_AGO = 1e6;
/** How far below the mist a fallen piece has to go before it is gone. */
const GONE_BELOW = -12;
const FALL_GRAVITY = 20;
/** How fast a tipping log settles back level with nobody on it, and a sagged moss pad rises back. */
const SETTLE_RATE = 0.5;
const SAG_RATE = 0.3;

export const newPiece = (s: Solid): Piece => ({
  phase: s.motion?.kind === 'sway' ? swayPhase(s.motion, 0).phase : s.motion?.kind === 'float' ? 'gone' : 'rest',
  clock: s.motion?.kind === 'float' ? LONG_AGO : 0,
  baseTop: s.top,
  thickness: s.top - s.bottom,
  dip: s.motion?.kind === 'float' ? FLOAT_LOW : 0,
  speed: 0,
  telling: false,
});

/** A copy of the level's solids in which every moving one is this game's own, at rest. */
export const ownPieces = (solids: Solid[]): Solid[] =>
  solids.map((s) => {
    if (!s.motion) return s;
    const own: Solid = { ...s, slopeZ: 0, gone: false };
    own.piece = newPiece(own);
    place(own);
    return own;
  });

const smooth = (s: number): number => s * s * (3 - 2 * s);

/** Where a swaying piece is in its rhythm after `seconds`: its phase, how high it is (0 to 1), and whether it is telling. */
export const swayPhase = (m: Extract<Motion, { kind: 'sway' }>, seconds: number): { phase: PiecePhase; lift: number; telling: boolean; left: number } => {
  const period = 2 * (m.rest + m.move);
  const c = ((((seconds + m.start) % period) + period) % period);
  if (c < m.rest) return { phase: 'rest', lift: 0, telling: c > m.rest - m.tell, left: m.rest - c };
  if (c < m.rest + m.move) return { phase: 'rise', lift: smooth((c - m.rest) / m.move), telling: false, left: 0 };
  if (c < 2 * m.rest + m.move) {
    const into = c - m.rest - m.move;
    return { phase: 'high', lift: 1, telling: into > m.rest - m.tell, left: m.rest - into };
  }
  return { phase: 'sink', lift: 1 - smooth((c - 2 * m.rest - m.move) / m.move), telling: false, left: 0 };
};

/** Puts a piece's top, underside and tilt where its state says. */
const place = (s: Solid): void => {
  const p = s.piece;
  const m = s.motion;
  if (!p || !m) return;
  let top = p.baseTop;
  if (m.kind === 'tip') {
    // The middle stays put; the far end (forward, which is -z) is `dip` lower.
    s.slopeZ = p.dip / s.halfZ;
  } else if (m.kind === 'crumble' || m.kind === 'float') {
    // `dip` is how far it has sagged or fallen, or how far under a crocodile's back is.
    top = p.baseTop - p.dip;
  } else {
    top = p.baseTop + m.rise * swayPhase(m, p.clock).lift;
  }
  s.top = top;
  s.bottom = top - p.thickness;
  s.gone = p.phase === 'gone';
};

/**
 * Moves every moving piece on by `dt` seconds. `standing` is the solid the
 * hero stands on (null in the air), and `forward` how far along that solid
 * from its middle the hero stands, in metres, forward positive. `hero` is where
 * the hero is, seen from above: crocodile stepping stones come up when one is
 * near. Returns what began.
 */
export const stepPieces = (solids: Solid[], standing: string | null, forward: number, dt: number, hero?: { x: number; z: number }): PieceEvent[] => {
  const events: PieceEvent[] = [];
  for (const s of solids) {
    const p = s.piece;
    const m = s.motion;
    if (!p || !m) continue;
    const on = standing === s.id;
    const say = (what: PieceEvent['what']): void => {
      events.push({ id: s.id, kind: m.kind, what });
    };
    if (m.kind === 'tip') {
      p.clock += dt;
      if (on && p.phase === 'rest') {
        p.phase = 'tell';
        p.clock = 0;
        say('tell');
      }
      if (!on && p.phase !== 'rest') {
        p.phase = 'rest';
        p.clock = 0;
      }
      if (p.phase === 'tell' && p.clock >= m.tell) {
        p.phase = 'tip';
        p.clock = 0;
        say('move');
      }
      const want = p.phase === 'tip' ? m.dip * Math.max(-1, Math.min(1, forward / s.halfZ)) : 0;
      const rate = p.phase === 'tip' ? m.rate : p.phase === 'tell' ? 0 : SETTLE_RATE;
      p.dip += Math.max(-rate * dt, Math.min(rate * dt, want - p.dip));
    } else if (m.kind === 'crumble') {
      p.clock += dt;
      if (p.phase === 'rest') {
        // A sagged pad rises back while nobody is on it. `dip` holds how far down it still is.
        if (p.dip > 0 && !on) p.dip = Math.max(0, p.dip - SAG_RATE * dt);
        if (on && p.dip <= 0) {
          p.phase = 'tell';
          p.clock = 0;
          say('tell');
        }
      } else if (p.phase === 'tell') {
        if (p.clock >= m.tell) {
          p.phase = m.falls ? 'fall' : 'sag';
          p.clock = 0;
          p.speed = 0;
          p.dip = 0;
          say(m.falls ? 'fall' : 'move');
        }
      } else if (p.phase === 'sag') {
        p.dip = Math.min(p.clock * SAG_RATE, m.sag);
        // It holds while anyone is on it; left alone a moment, it rises back.
        if (!on && p.clock > m.sag / SAG_RATE + 0.5) {
          p.phase = 'rest';
          p.clock = 0;
        }
      } else if (p.phase === 'fall') {
        p.speed += FALL_GRAVITY * dt;
        p.dip += p.speed * dt;
        if (p.baseTop - p.dip < GONE_BELOW) {
          p.phase = 'gone';
          p.clock = 0;
        }
      } else if (p.phase === 'gone' && p.clock >= m.back) {
        p.phase = 'rest';
        p.clock = 0;
        p.dip = 0;
        p.speed = 0;
        say('back');
      }
    } else if (m.kind === 'float') {
      p.clock += dt;
      const near = hero !== undefined && Math.hypot(hero.x - s.x, hero.z - s.z) <= m.wake;
      if (p.phase === 'gone') {
        p.dip = FLOAT_LOW;
        // Lying low: it comes up when a hero is near, once it has been under long enough.
        if (near && p.clock >= m.down) {
          p.phase = 'rise';
          p.clock = 0;
          say('back');
        }
      } else if (p.phase === 'rise') {
        p.dip = FLOAT_LOW * (1 - smooth(Math.min(1, p.clock / m.rise)));
        if (p.clock >= m.rise) {
          p.phase = 'rest';
          p.clock = 0;
          p.dip = 0;
        }
      } else if (p.phase === 'rest') {
        if (on) {
          // The moment a hero lands on it, it starts to count.
          p.phase = 'tell';
          p.clock = 0;
        } else if (near) p.clock = 0;
        else if (p.clock >= FLOAT_BORED) {
          p.phase = 'sink';
          p.clock = 0;
        }
      } else if (p.phase === 'tell') {
        // It holds for `hold` seconds from the first step on it, hero or no hero. The last `tell` of that is its warning.
        const telling = p.clock >= m.hold - m.tell;
        if (telling && !p.telling) say('tell');
        p.telling = telling;
        if (p.clock >= m.hold) {
          if (m.snap && on) say('snap');
          p.phase = 'sink';
          p.clock = 0;
          p.telling = false;
          say('fall');
        }
      } else if (p.phase === 'sink') {
        p.dip = FLOAT_LOW * smooth(Math.min(1, p.clock / FLOAT_SINK));
        if (p.clock >= FLOAT_SINK) {
          p.phase = 'gone';
          p.clock = 0;
        }
      }
    } else {
      p.clock += dt;
      const now = swayPhase(m, p.clock);
      if (now.telling && !p.telling) say('tell');
      if (now.phase !== p.phase && (now.phase === 'rise' || now.phase === 'sink')) say('move');
      p.phase = now.phase;
      p.telling = now.telling;
    }
    place(s);
  }
  return events;
};

/** Puts tipping and crumbling pieces back as they started. Swaying ones keep the wind's rhythm. */
export const resetPieces = (solids: Solid[]): void => {
  for (const s of solids) {
    if (!s.piece || !s.motion || s.motion.kind === 'sway') continue;
    const float = s.motion.kind === 'float';
    s.piece.phase = float ? 'gone' : 'rest';
    s.piece.clock = float ? LONG_AGO : 0;
    s.piece.dip = float ? FLOAT_LOW : 0;
    s.piece.speed = 0;
    s.piece.telling = false;
    place(s);
  }
};

/**
 * How many seconds a piece will stay at the height it is now: as long as
 * the rest it is in for a swaying piece (0 while it moves), and for any other
 * kind as long as nobody stands on it (Infinity).
 */
export const steadyFor = (s: Solid): number => {
  const m = s.motion;
  if (!m || !s.piece) return Infinity;
  if (m.kind === 'float') {
    // A crocodile's back: steady while it floats untouched, for what is left of its hold once stepped on, and not at all otherwise.
    if (s.piece.phase === 'rest') return Infinity;
    return s.piece.phase === 'tell' ? Math.max(0, m.hold - s.piece.clock) : 0;
  }
  if (m.kind !== 'sway') return Infinity;
  const now = swayPhase(m, s.piece.clock);
  return now.phase === 'rest' || now.phase === 'high' ? now.left : 0;
};
