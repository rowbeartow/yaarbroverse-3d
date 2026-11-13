// The two heroes. Each is drawn from its model file (see hero-model.ts): a
// textured model on a skeleton, made by the owner from the Caputo Mountain art.
// Yaarbro in his blue tunic with the orange beard, Caputo grey-brown with dark
// stripes, long fangs and green eyes.

import type { Group } from 'three';
import type { HeroName } from '../game/hero';
import type { Assets } from './assets';
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
}

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
  /** Something just happened: a jump, a landing, or a bounce off a mushroom. */
  react(event: 'jump' | 'land' | 'bounce'): void;
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
