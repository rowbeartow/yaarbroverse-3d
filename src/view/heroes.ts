// The two heroes. Each is drawn from its model file (see hero-model.ts): a
// textured model on a skeleton, made by the owner from the Caputo Mountain art.
// Yaarbro in his blue tunic with the orange beard, Caputo grey-brown with dark
// stripes, long fangs and green eyes.

import type { Group, Object3D, Vector3 } from 'three';
import type { HeroName } from '../game/hero';
import type { Assets } from './assets';
import type { Grips, JawGrip } from './held-tackle';
import { HERO_MODELS, ModelHero, STAND_IN, wantsStandIn } from './hero-model';

/** What the hero is doing this frame, for the animation. */
export interface Pose {
  /** Sideways speed as a share of walking speed, 0 to 1. */
  pace: number;
  grounded: boolean;
  /** Upward speed; negative when dropping. */
  rise: number;
  /** Tucked into a roll right now (Yaarbro). */
  rolling?: boolean;
  /** How far through a pounce, 0 to 1, or null when not pouncing (Caputo). */
  pounce?: number | null;
  /** In the water: at the surface, or with the head under. Left out on land. */
  water?: 'surface' | 'under' | null;
  /** How far through climbing out of the water, 0 to 1, or null when not climbing. */
  climbing?: number | null;
  /** On a rope: reaching out for one coming near, or hanging from one. Left out otherwise. */
  rope?: 'reach' | 'hang' | null;
  /**
   * Fishing: aiming a cast, the lure in the air, waiting for a bite, a fish
   * on the line, or showing off a landed fish; with the seconds the rules have
   * spent in that phase, and whether the button is reeling. Left out otherwise.
   */
  fishing?: { phase: 'aim' | 'cast' | 'wait' | 'hooked' | 'show'; timer: number; reeling: boolean } | null;
  /** How many times the new button has been sent this run (see ability.ts): the hero's clip for it plays each time this goes up. */
  strikes?: number;
}

/**
 * What a hero holds things with while fishing, for drawing them (see
 * held-tackle.ts): the grip points in its palms and its hand bones, or the
 * grip in its jaws and its head bone.
 */
export type HeroTackle = {
  /** Metres in the game for a metre of rod as held-tackle.ts gives it: the rod is the same size whoever holds it. */
  unit: number;
  /** How far through showing off a landed fish it is, 0 to 1, or null when it is not. */
  show: number | null;
} & ({ grips: Grips; right: Object3D; left: Object3D } | { jaws: JawGrip; head: Object3D });

/** What the browser checks can ask about the hero on screen. */
export interface HeroInfo {
  /** The model file the hero is drawn from. */
  model: string;
  /** The animation clips in that file, by name. */
  clips: string[];
  /** Seconds of animation played so far. */
  clock: number;
}

export interface HeroView {
  root: Group;
  /** Size of the soft spot on the ground: across and along the body. */
  shadow: { across: number; along: number };
  /** Where a portrait camera should look, and from how far. */
  portrait: { height: number; distance: number };
  animate(pose: Pose, dt: number): void;
  /** Something just happened: a jump, a landing, a bounce off a mushroom, the end of climbing out of the water, taking hold of a rope or letting go. */
  react(event: 'jump' | 'land' | 'bounce' | 'out' | 'catch' | 'letgo'): void;
  /** Where the hero holds a rope, in the world, as drawn now (see hero-model.ts). False for a hero with no grip. */
  grip(into: Vector3): boolean;
  /** How much the hero is held by a rope right now, 0 to 1. */
  readonly held: number;
  /** Its palms or its jaws, for what it holds while fishing, or null for a hero with no fishing clips. Call after `animate`. */
  tackle(): HeroTackle | null;
  info(): HeroInfo;
  /** For a ghost: how much of it shows, from 0 (gone) to 1. */
  fade(share: number): void;
  /** Frees what this hero held. */
  dispose(): void;
}

/** The model files to download before the game can start. */
export const HERO_MODEL_FILES = (): string[] => {
  const files = new Set<string>();
  if (wantsStandIn()) files.add(STAND_IN.file);
  for (const spec of Object.values(HERO_MODELS)) files.add(spec.file);
  return [...files];
};

/**
 * Builds a hero from its model file. With ?standin in the address, every hero
 * is the stand-in model instead, which checks the loader and animation player
 * against a file with clips of its own for standing and jumping. `ghost`
 * builds the see-through copy a player races: the recording of their best run.
 */
export const buildHero = (name: HeroName, assets: Assets, simple = false, ghost = false): HeroView => {
  const spec = wantsStandIn() ? STAND_IN : HERO_MODELS[name];
  const loaded = assets.models.get(spec.file);
  if (!loaded) throw new Error(`The model file ${spec.file} was not loaded`);
  return new ModelHero(spec, loaded, simple, ghost);
};
