// Draws the game: builds the scene for a level and hero, lights it, then each
// frame moves the hero, the shadow and the camera to match the game rules' state.
//
// Light comes from three places: a forest photograph wrapped round the scene
// (image-based lighting), a warm sun that casts soft shadows, and a glow pass
// for the brightest things. A filmic curve maps it all to the screen.

import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Color,
  Fog,
  Group,
  HalfFloatType,
  HemisphereLight,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Game, GameEvent } from '../game/game';
import { MOVE, type HeroName } from '../game/hero';
import { surfaceBelow, topAt, type Level } from '../game/level';
import { loadAssets, type Assets } from './assets';
import type { GhostPose } from '../game/ghost';
import type { SceneryName } from '../levels/entry';
import { Scatter, buildForest, type Forest } from './forest';
import { bossFighting } from '../game/boss';
import { BossView } from './boss';
import { FIGHT_CAMERA, fightView } from './boss-camera';
import { ENEMY_MODELS, ENEMY_MODEL_FILES, EnemyView } from './enemies';
import { HERO_MODEL_FILES, buildHero, type HeroView } from './heroes';
import { Materials, WIND, installMist } from './materials';
import { seeded } from './noise';
import { MIST_COLOR } from './pictures';
import { UNDERWATER_FOG, WaterView, sightBlocked, underwaterCeiling, underwaterDepth } from './water';
import { MIST_FAR, MIST_NEAR, inDetail, inView } from './route';
import { TIERS, TierChooser, frameRateGoal, isTierName, startingTier, type Tier, type TierName } from './quality';
import { MIST_BOTTOM, MIST_TOP, animateMushroom, blobShadow, buildSolids, placeMoving, type LevelSolids } from './scenery';

/** Where the camera sits relative to the hero: behind, above, looking ahead and down. */
const CAMERA = { back: 12, up: 8, lookAhead: 4.5, lookUp: 1, fieldOfView: 50 };

/** Which way the sunlight travels from: left, above and a little behind the camera. */
const SUN_FROM = new Vector3(-0.52, 0.76, 0.4).normalize();
/** How much ground the sun's shadows cover around the hero, in metres. */
const SHADOW_REACH = 34;

/**
 * The name the graphics card gives itself, read from a throwaway picture
 * before the real one is made. Empty when the browser will not say.
 */
const graphicsCardName = (): string => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
};

const ease = (from: number, to: number, rate: number, dt: number): number =>
  from + (to - from) * (1 - Math.exp(-rate * dt));

/** What the picture is doing, for the frame counter (shown when the address ends in ?fps). */
export interface ViewStats {
  framesPerSecond: number;
  tier: TierName;
  /** Whether the tier is chosen automatically or fixed in the address bar. */
  automatic: boolean;
  pixelRatio: number;
  drawCalls: number;
  triangles: number;
}

/**
 * What is drawn around a level's solids, by the name the level gives in its
 * entry (`scenery` in its `level.ts`). A new kind of surroundings is a builder
 * added here and a name added to `SceneryName` in `src/levels/entry.ts`.
 */
const SURROUNDINGS: Record<SceneryName, typeof buildForest> = {
  forest: buildForest,
};

interface LevelView extends LevelSolids {
  root: Group;
  forest: Forest;
  scatter: Scatter;
  /** The level's pools, if it has any. */
  water: WaterView | null;
}

/**
 * Underwater: the camera comes in close behind the swimmer and just under the
 * surface, and the fog closes in and turns blue-green. How far back and up it
 * sits, how near and far the fog is, and how quickly the look comes and goes.
 */
const UNDERWATER = { back: 4.6, up: 0.9, lookAhead: 3, fogNear: 0.5, fogFar: 24, below: 0.35, ease: 3.5 };

export class GroveView {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA.fieldOfView, 1, 0.1, 500);
  private readonly sun = new DirectionalLight(0xffe6bd, 3.1);
  /** Sky-and-ground light for the plain shading of the lowest tier, which has no forest light. */
  private readonly fill = new HemisphereLight(0xfff3d6, 0x5a8a72, 0);
  private readonly shadow: Mesh = blobShadow();
  private materials: Materials;
  private readonly chooser: TierChooser;
  private readonly automatic: boolean;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private tier: Tier;
  private levelView: LevelView | null = null;
  private hero: HeroView | null = null;
  /** The see-through copy of the hero that replays the player's best run, when there is one to race. */
  private ghost: HeroView | null = null;
  private ghostShown = false;
  private ghostName: HeroName | null = null;
  private scenery: SceneryName = 'forest';
  private enemies: EnemyView[] = [];
  private boss: BossView | null = null;
  /** Seconds since the goal came within reach (a boss was beaten), or -1. */
  private sinceOpen = -1;
  /** How far into its boss-fight place the camera is, 0 to 1. */
  private fight = 0;
  private heroName: HeroName | null = null;
  private level: Level | null = null;
  private follow = { x: 0, y: 0, z: 0 };
  private lowestGround = 0;
  private clock = 0;
  private sinceGoal = -1;
  private blink = 0;
  private size = { width: 1, height: 1 };
  /** Water events waiting for the next frame, which knows where the hero is. */
  private swimEvents: GameEvent[] = [];
  /** How far into the underwater look the picture is, 0 to 1. */
  private under = 0;
  /** Seconds until the next ring behind a swimmer at the surface, and the next bubbles from one underwater. */
  private nextWake = 0;
  private nextBubbles = 0;
  private readonly fogAbove = new Color(MIST_COLOR);
  private readonly fogBelow = new Color(UNDERWATER_FOG);
  private lastFrame = 0;
  private smoothedRate = 0;
  private drawn = { calls: 0, triangles: 0 };

  /**
   * Sets up the 3D picture and downloads what it needs. `onProgress` gets a
   * number from 0 to 1. Throws if the browser cannot draw 3D (an error named
   * 'No3d') or a file fails to arrive; main.ts shows a plain message for each.
   */
  static async create(canvas: HTMLCanvasElement, onProgress: (share: number) => void): Promise<GroveView> {
    // Choose where to start from what the device says about itself, or from
    // the address bar (?quality=high, medium, low or minimal). This comes
    // first because smooth edges are fixed when the picture is created, and a
    // machine drawing in software cannot afford them.
    const touch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    const asked = new URLSearchParams(window.location.search).get('quality');
    const start = isTierName(asked) ? asked : startingTier({ touch, renderer: graphicsCardName() });
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: start !== 'minimal', alpha: true, powerPreference: 'high-performance' });
    } catch (cause) {
      const error = new Error('This browser cannot draw 3D', { cause });
      error.name = 'No3d';
      throw error;
    }
    const assets = await loadAssets(renderer, [...HERO_MODEL_FILES(), ...ENEMY_MODEL_FILES()], onProgress);
    return new GroveView(renderer, assets, start, !isTierName(asked), touch);
  }

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly assets: Assets,
    start: TierName,
    automatic: boolean,
    touch: boolean,
  ) {
    installMist(MIST_TOP, MIST_BOTTOM);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    // Count what a whole frame draws, glow passes included (for the frame counter).
    renderer.info.autoReset = false;
    renderer.shadowMap.type = PCFShadowMap;

    this.automatic = automatic;
    this.chooser = new TierChooser(start, frameRateGoal(touch).floor, automatic);
    this.tier = TIERS[start];

    this.materials = new Materials(assets, this.tier.simple);
    assets.setAnisotropy(this.tier.anisotropy);

    this.scene.environmentIntensity = 0.85;
    this.scene.fog = new Fog(MIST_COLOR, MIST_NEAR, MIST_FAR);
    this.sun.shadow.camera.left = -SHADOW_REACH;
    this.sun.shadow.camera.right = SHADOW_REACH;
    this.sun.shadow.camera.top = SHADOW_REACH;
    this.sun.shadow.camera.bottom = -SHADOW_REACH;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 190;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 2.5;
    this.scene.add(this.sun, this.sun.target, this.fill, this.shadow);
    this.applyTier();
  }

  /** Builds the scene for a level and hero, replacing whatever was shown before. */
  show(level: Level, heroName: HeroName, scenery: SceneryName = 'forest'): void {
    if (this.levelView) {
      this.scene.remove(this.levelView.root);
      this.dispose(this.levelView.root);
    }
    if (this.hero) {
      this.scene.remove(this.hero.root);
      this.hero.dispose();
    }
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.root, ...enemy.extras);
      enemy.dispose();
    }
    if (this.boss) {
      this.scene.remove(this.boss.root, ...this.boss.extras);
      this.boss.dispose();
      this.boss = null;
    }
    this.sinceOpen = -1;
    this.fight = 0;
    if (level.boss) {
      const loaded = this.assets.models.get(ENEMY_MODELS[level.boss.look.model].file);
      if (!loaded) throw new Error(`The model file for ${level.boss.name} was not loaded`);
      this.boss = new BossView(level.boss, loaded, this.tier.simple);
      this.scene.add(this.boss.root, ...this.boss.extras);
    }
    this.setGhost(null);
    this.enemies = (level.enemies ?? []).map((spot) => {
      const spec = ENEMY_MODELS[spot.kind];
      const loaded = this.assets.models.get(spec.file);
      if (!loaded) throw new Error(`The model file ${spec.file} was not loaded`);
      const enemy = new EnemyView(spec, loaded, this.tier.simple);
      this.scene.add(enemy.root, ...enemy.extras);
      return enemy;
    });
    this.level = level;
    this.heroName = heroName;
    this.scenery = scenery;
    const random = seeded(20261110);
    const scatter = new Scatter();
    const solids = buildSolids(level, this.materials, scatter, random);
    const forest = SURROUNDINGS[scenery](level, this.materials, scatter, random);
    const root = new Group();
    root.add(solids.group, forest.group, scatter.build(this.materials));
    const water = level.water?.length ? new WaterView(level.water, this.materials, this.tier.simple) : null;
    if (water) root.add(water.group);
    this.levelView?.water?.dispose();
    this.levelView = { ...solids, root, forest, scatter, water };
    this.swimEvents = [];
    this.under = 0;
    this.hero = buildHero(heroName, this.assets, this.tier.simple);
    this.scene.add(root, this.hero.root);
    this.lowestGround = Math.min(...level.solids.map((s) => s.top));
    this.follow = { ...level.spawn };
    this.sinceGoal = -1;
    this.blink = 0;
    this.shadow.scale.set(this.hero.shadow.across, this.hero.shadow.along, 1);
    this.applyDetail();
  }

  /**
   * Puts a ghost in the scene, or takes it out (null). The ghost is a
   * see-through copy of the hero, placed each frame from a recording. It is a
   * picture only: the rules never hear of it.
   */
  setGhost(heroName: HeroName | null): void {
    if (this.ghost) {
      this.scene.remove(this.ghost.root);
      this.ghost.dispose();
      this.ghost = null;
    }
    this.ghostShown = false;
    this.ghostName = heroName;
    if (!heroName) return;
    this.ghost = buildHero(heroName, this.assets, this.tier.simple, true);
    this.ghost.root.visible = false;
    this.scene.add(this.ghost.root);
  }

  /** What the browser checks can ask about the ghost: whether it is drawn, and where. */
  ghostInfo(): { shown: boolean; x: number; y: number; z: number } | null {
    if (!this.ghost) return null;
    const { x, y, z } = this.ghost.root.position;
    return { shown: this.ghostShown, x, y, z };
  }

  /** What the browser checks can ask about the water: what is drawn, and how far into the underwater look the picture is (0 to 1). */
  waterInfo(): { pools: number; drops: number; rings: number; underwater: number } | null {
    const water = this.levelView?.water;
    if (!water) return null;
    const fog = this.scene.fog as Fog;
    return { ...water.info(), underwater: Math.max(0, Math.min(1, (MIST_FAR - fog.far) / (MIST_FAR - UNDERWATER.fogFar))) };
  }

  /** Reacts to what just happened in the rules: squash a mushroom, stretch the hero, and so on. */
  handle(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'bounce') {
        const mushroom = this.levelView?.mushrooms.get(event.solidId);
        if (mushroom) mushroom.sinceBounce = 0;
        this.hero?.react('bounce');
      } else if (event.type === 'jump') this.hero?.react('jump');
      else if (event.type === 'land') this.hero?.react('land');
      else if (event.type === 'fall') {
        this.blink = MOVE.returnPause;
      } else if (event.type === 'strike') {
        const index = this.level?.enemies?.findIndex((spot) => spot.id === event.id) ?? -1;
        this.enemies[index]?.strike();
      } else if (event.type === 'boss' && event.what === 'hit') this.boss?.strike();
      else if (event.type === 'boss' && event.what === 'beaten') this.sinceOpen = 0;
      else if (event.type === 'goal') this.sinceGoal = 0;
      else if (event.type === 'splash' || event.type === 'dive' || event.type === 'surface' || event.type === 'climb') this.swimEvents.push(event);
    }
  }

  /**
   * Draws one frame. `before` is where the hero was one rules step ago and
   * `blend` how far between that and now the screen is, so motion stays smooth
   * on screens faster than the rules' 60 steps a second.
   */
  frame(game: Game, before: { x: number; y: number; z: number }, blend: number, dt: number, ghostPose: GhostPose | null = null): void {
    const { hero, levelView, level } = this;
    if (!hero || !levelView || !level) return;

    // Real time between frames, whether or not the game is running, for the
    // wind, the mist and the frame-rate watch.
    const now = performance.now();
    const real = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 1.5) : 0;
    this.lastFrame = now;
    if (real > 0) {
      // Slow frames count in full straight away; fast ones are averaged so the number is readable.
      const rate = 1 / real;
      this.smoothedRate = this.smoothedRate && rate > 8 ? this.smoothedRate + (rate - this.smoothedRate) * 0.08 : rate;
    }
    const dropTo = this.chooser.frame(real);
    if (dropTo) {
      this.tier = TIERS[dropTo];
      this.applyTier();
    }
    WIND.time.value += Math.min(real, 0.1);
    this.drawn = { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
    this.renderer.info.reset();

    this.clock += dt;
    const x = before.x + (game.x - before.x) * blend;
    const y = before.y + (game.y - before.y) * blend;
    const z = before.z + (game.z - before.z) * blend;

    // Hero.
    hero.root.position.set(x, y, z);
    let turn = game.facing - hero.root.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    hero.root.rotation.y += turn * (1 - Math.exp(-14 * dt));
    hero.animate(
      {
        pace: Math.min(Math.hypot(game.vx, game.vz) / MOVE.walkSpeed, 1),
        grounded: game.grounded,
        rise: game.vy,
        rolling: game.rolling,
        pounce: game.pouncing > 0 ? 1 - game.pouncing / MOVE.pounceTime : null,
      },
      dt,
    );
    // The ghost: where the recording says, doing what it says. It fades out
    // when it is on top of the player's own hero, so the hero is never hidden.
    if (this.ghost) {
      this.ghostShown = ghostPose !== null;
      this.ghost.root.visible = this.ghostShown;
      if (ghostPose) {
        this.ghost.root.position.set(ghostPose.x, ghostPose.y, ghostPose.z);
        this.ghost.root.rotation.y = ghostPose.facing;
        this.ghost.animate(
          { pace: ghostPose.pace, grounded: ghostPose.grounded, rise: ghostPose.rise, rolling: ghostPose.rolling, pounce: ghostPose.pouncing ? 0.5 : null },
          dt,
        );
        const apart = Math.hypot(ghostPose.x - x, ghostPose.y - y, ghostPose.z - z);
        this.ghost.fade((apart - 0.5) / 1.5);
      }
    }
    this.blink = Math.max(0, this.blink - dt);
    const tuning = level.enemyTuning ?? { warning: 1, speed: 1, rest: 1 };
    this.enemies.forEach((enemy, i) => enemy.update(game.enemies[i], tuning, game.z, dt));
    if (this.boss && game.boss) this.boss.update(game.boss, game.z, dt);

    // The hero flickers while standing still after a fall, and for as long as
    // nothing can hurt it after a hit.
    const flicker = Math.max(this.blink, game.protectedFor);
    hero.root.visible = flicker <= 0 || Math.floor(flicker * 12) % 2 === 0;

    // The soft spot drops straight down onto whatever is below. No ground, no spot.
    const ground = surfaceBelow(level, x, z, y + level.ledgeHelp, MOVE.footRadius);
    this.shadow.visible = ground !== null;
    if (ground) {
      const groundY = topAt(ground, x, z);
      const height = Math.max(y - groundY, 0);
      const shrink = 1 / (1 + height * 0.12);
      this.shadow.position.set(x, groundY + 0.03, z);
      this.shadow.rotation.z = hero.root.rotation.y;
      this.shadow.scale.set(hero.shadow.across * shrink, hero.shadow.along * shrink, 1);
    }

    // Water: splashes, rings behind a swimmer, bubbles from one underwater, drips from one climbing out.
    if (levelView.water) {
      const water = levelView.water;
      for (const event of this.swimEvents) {
        if (event.type === 'splash') water.splash(x, z, Math.min(1, event.speed / 14));
        else if (event.type === 'dive') water.ring(x, z, 1.6);
        else if (event.type === 'surface') {
          water.ring(x, z, 1.8);
          water.splash(x, z, 0.05);
        } else if (event.type === 'climb') water.drips(x, y + 0.5, z, 10);
      }
      this.swimEvents = [];
      const speed = Math.hypot(game.vx, game.vz);
      this.nextWake -= dt;
      if (game.swimming && !game.under && this.nextWake <= 0) {
        // A ring every so often while treading water, and more often while swimming.
        water.ring(x, z, speed > 0.5 ? 1.3 : 0.9, speed > 0.5 ? 0.9 : 1.4);
        this.nextWake = speed > 0.5 ? 0.42 : 1.1;
      }
      this.nextBubbles -= dt;
      if (game.under && this.nextBubbles <= 0) {
        water.bubbles(x, y + game.bodyHeight * 0.8, z, speed > 0.5 ? 2 : 1);
        this.nextBubbles = 0.3 + ((this.clock * 7.3) % 1) * 0.4;
      }
      water.update(dt);
    }

    // Pieces that move, where the rules have them now.
    for (const piece of levelView.moving) placeMoving(piece, this.clock, dt);

    // Mushrooms and the golden leaf.
    for (const mushroom of levelView.mushrooms.values()) animateMushroom(mushroom, dt);
    const leaf = levelView.leaf;
    leaf.sparkles.rotation.y = WIND.time.value * 0.5;
    // A level with a boss keeps its leaf out of sight until the boss is beaten. Then it bursts into view.
    leaf.group.visible = game.goalOpen;
    if (this.sinceOpen >= 0) this.sinceOpen += dt;
    const burst = this.sinceOpen >= 0 && this.sinceOpen < 1 ? Math.sin(this.sinceOpen * Math.PI) : 0;
    leaf.group.scale.setScalar(this.sinceOpen >= 0 ? Math.min(1, this.sinceOpen / 0.35) * (1 + burst * 0.8) : 1);
    if (this.sinceGoal >= 0) {
      this.sinceGoal += dt;
      const t = Math.min(this.sinceGoal / 1.2, 1);
      leaf.blade.rotation.y += dt * (6 + t * 18);
      leaf.group.position.y = leaf.baseY + t * 1.6;
      leaf.blade.scale.setScalar(1.25 * (1 + Math.sin(t * Math.PI) * 0.9));
      leaf.halo.scale.setScalar(3.6 + t * 5);
    } else {
      leaf.blade.rotation.y += Math.min(real, 0.1) * 1.6;
      leaf.group.position.y = leaf.baseY + Math.sin(WIND.time.value * 2) * 0.12;
      leaf.blade.scale.setScalar(1.25);
      leaf.halo.scale.setScalar(3.6 + Math.sin(WIND.time.value * 3) * 0.3);
    }

    // Camera: follow smoothly, slower up and down so jumps do not shake the view,
    // and never chase a falling hero into the mist.
    // A swimmer underwater is followed down: the camera dips under the surface with it.
    this.under = Math.max(0, Math.min(1, this.under + (game.swimming && game.under ? dt * UNDERWATER.ease : -dt * UNDERWATER.ease)));
    const followY = this.under > 0 ? y : Math.max(y, this.lowestGround - 0.5);
    // While a boss fight is on, the camera follows a point between the hero and the middle of the arena.
    const fighting = game.boss !== null && bossFighting(game.boss);
    this.fight = Math.max(0, Math.min(1, this.fight + (fighting ? dt / FIGHT_CAMERA.easeIn : -dt / FIGHT_CAMERA.easeOut)));
    const aim = fightView(this.fight, { x, z }, level.boss);
    this.follow.x = ease(this.follow.x, aim.x, 7, dt);
    this.follow.z = ease(this.follow.z, aim.z, 7, dt);
    this.follow.y = ease(this.follow.y, followY, game.grounded || game.swimming ? 5 : 2.6, dt);
    this.aimCamera();
    this.aimUnderwater(game);
    this.aimSun();
    // Only the stretch of the grove near the camera is drawn: the mist hides the rest.
    levelView.forest.update(WIND.time.value, this.follow.z);
    levelView.scatter.show(this.follow.z);
    for (const piece of levelView.pieces) {
      piece.shape.visible = inView(piece.near, piece.far, this.follow.z);
      const close = inDetail(piece.near, this.follow.z);
      for (const part of piece.fine) part.visible = close;
    }
    levelView.forest.sky.position.copy(this.camera.position);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Puts the camera straight on the hero, with no easing (after a restart). */
  snapCamera(game: Game): void {
    this.follow = { x: game.x, y: game.y, z: game.z };
    if (this.hero) this.hero.root.rotation.y = game.facing;
  }

  private aimCamera(): void {
    const { x, y, z } = this.follow;
    // In a boss fight the camera sits further back and higher, so the whole arena shows (see boss-camera.ts).
    const { back, up } = fightView(this.fight, { x, z }, this.level?.boss);
    this.camera.position.set(x * 0.85, y + CAMERA.up * up, z + CAMERA.back * back);
    this.camera.lookAt(x * 0.92, y + CAMERA.lookUp, z - CAMERA.lookAhead);
  }

  /**
   * The look underwater. While the swimmer's head is under, the camera eases
   * in close behind it and just under the surface; and whenever the camera is
   * under a pool's surface the fog closes in and turns blue-green, and shafts
   * of light come down from above.
   */
  private aimUnderwater(game: Game): void {
    const level = this.level;
    const water = this.levelView?.water;
    if (!level || !water) return;
    const share = this.under * this.under * (3 - 2 * this.under);
    const pool = game.water ?? level.water?.find((w) => this.follow.x >= w.minX && this.follow.x <= w.maxX && this.follow.z >= w.minZ && this.follow.z <= w.maxZ);
    if (share > 0 && pool) {
      const { x, y, z } = this.follow;
      const behind = Math.min(z + UNDERWATER.back, pool.maxZ - 0.3);
      const close = new Vector3(x, Math.min(y + UNDERWATER.up, underwaterCeiling(pool, level.solids, x, behind, UNDERWATER.below)), behind);
      // On the way in or out, the camera never looks at the swimmer through rock (an arch over the water):
      // where the spot between the two views cannot see it, it cuts to whichever end can, the nearer first.
      const swimmer = { x, y: y + 0.5, z };
      const above = this.camera.position.clone();
      let spot = share;
      if (sightBlocked(level.solids, above.clone().lerp(close, share), swimmer)) {
        const order = share >= 0.5 ? [1, 0] : [0, 1];
        spot = order.find((end) => !sightBlocked(level.solids, end === 1 ? close : above, swimmer)) ?? 1;
      }
      this.camera.position.copy(above.lerp(close, spot));
      const look = new Vector3(x * 0.92, y + CAMERA.lookUp, z - CAMERA.lookAhead).lerp(new Vector3(x, y + 0.4, z - UNDERWATER.lookAhead), spot);
      this.camera.lookAt(look);
    }
    const p = this.camera.position;
    const depth = underwaterDepth(level.water, p.x, p.y, p.z);
    const below = Math.min(1, depth / 0.15);
    const fog = this.scene.fog as Fog;
    fog.color.copy(this.fogAbove).lerp(this.fogBelow, below);
    fog.near = MIST_NEAR + (UNDERWATER.fogNear - MIST_NEAR) * below;
    fog.far = MIST_FAR + (UNDERWATER.fogFar - MIST_FAR) * below;
    water.setUnder(below, WIND.time.value);
  }

  /**
   * Keeps the sun's shadows over the part of the grove in view. The middle
   * moves in whole shadow-picture pixels, so shadow edges do not shimmer.
   */
  private aimSun(): void {
    const middle = new Vector3(this.follow.x * 0.9, this.follow.y, this.follow.z - 14);
    if (this.tier.shadowSize > 0) {
      const right = new Vector3(0, 1, 0).cross(SUN_FROM).normalize();
      const up = SUN_FROM.clone().cross(right);
      const pixel = (SHADOW_REACH * 2) / this.tier.shadowSize;
      const across = middle.dot(right);
      const along = middle.dot(up);
      middle.addScaledVector(right, Math.round(across / pixel) * pixel - across);
      middle.addScaledVector(up, Math.round(along / pixel) * pixel - along);
    }
    this.sun.target.position.copy(middle);
    this.sun.position.copy(middle).addScaledVector(SUN_FROM, 90);
  }

  /** Matches the drawing size to the window. */
  resize(width: number, height: number): void {
    this.size = { width, height };
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.camera.aspect = width / Math.max(height, 1);
    // On a tall, narrow window keep the sides in view by widening the angle a little.
    this.camera.fov = this.camera.aspect < 1.5 ? CAMERA.fieldOfView + (1.5 - this.camera.aspect) * 14 : CAMERA.fieldOfView;
    this.camera.updateProjectionMatrix();
  }

  /** Numbers for the frame counter. */
  stats(): ViewStats {
    return {
      framesPerSecond: this.smoothedRate,
      tier: this.tier.name,
      automatic: this.automatic,
      pixelRatio: this.renderer.getPixelRatio(),
      drawCalls: this.drawn.calls,
      triangles: this.drawn.triangles,
    };
  }

  /** What the boss on screen is showing, for the browser checks, or null when the level has none. */
  bossInfo(): ReturnType<BossView['info']> | null {
    return this.boss ? this.boss.info() : null;
  }

  /** Whether the golden leaf is drawn. */
  leafShown(): boolean {
    return this.levelView?.leaf.group.visible ?? false;
  }

  /** What each enemy on screen is showing, for the browser checks. */
  enemyInfo(): Array<{ clip: string; visible: boolean; aimLine: boolean; flashing: boolean }> {
    return this.enemies.map((enemy) => enemy.info());
  }

  /** What the hero on screen is made of and doing, for the browser checks. */
  heroInfo(): ReturnType<HeroView['info']> | null {
    return this.hero ? this.hero.info() : null;
  }

  /** Switches the picture to the current quality tier. */
  private applyTier(): void {
    const { tier, renderer } = this;

    // Plain or full shading is a different set of materials: rebuild the scene
    // with them, keeping the camera and the hero where they are.
    if (this.materials.simple !== tier.simple) {
      this.materials.dispose();
      this.materials = new Materials(this.assets, tier.simple);
      if (this.level && this.heroName) {
        const kept = { follow: this.follow, sinceGoal: this.sinceGoal, blink: this.blink, turn: this.hero?.root.rotation.y ?? 0 };
        const ghost = this.ghostName;
        this.show(this.level, this.heroName, this.scenery);
        // The ghost is rebuilt with the same plain or full shading as everything else.
        this.setGhost(ghost);
        this.follow = kept.follow;
        this.sinceGoal = kept.sinceGoal;
        this.blink = kept.blink;
        if (this.hero) this.hero.root.rotation.y = kept.turn;
      }
    }
    this.fill.intensity = tier.simple ? 2.1 : 0;
    this.sun.intensity = tier.simple ? 2.3 : 3.1;
    this.scene.environment = tier.simple ? null : this.assets.environment();

    const ratio = Math.min(window.devicePixelRatio || 1, tier.maxPixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(this.size.width, this.size.height, false);

    const shadows = tier.shadowSize > 0;
    renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (shadows && this.sun.shadow.mapSize.x !== tier.shadowSize) {
      this.sun.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // Lit materials are built for "with shadows" or "without": rebuild on a change.
    for (const material of this.materials.all()) material.needsUpdate = true;

    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    if (tier.bloom) {
      try {
        const { width, height } = this.size;
        const target = new WebGLRenderTarget(width * ratio, height * ratio, { type: HalfFloatType, samples: tier.samples });
        const composer = new EffectComposer(renderer, target);
        composer.setPixelRatio(ratio);
        composer.setSize(width, height);
        composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new Vector2(width, height), 0.26, 0.75, 0.95);
        composer.addPass(this.bloom);
        composer.addPass(new OutputPass());
        this.composer = composer;
      } catch (error) {
        // A device that cannot do the glow pass still gets the picture without it.
        console.warn('Glow is not available on this device', error);
        this.composer = null;
        this.bloom = null;
      }
    }
    this.applyDetail();
  }

  /** How much small scenery to draw, and whether tree crowns cast shadows. */
  private applyDetail(): void {
    if (!this.levelView) return;
    this.levelView.scatter.setDetail(this.tier.detail);
    this.levelView.forest.setDetail(this.tier.detail);
    for (const crown of this.levelView.forest.crowns) crown.castShadow = this.tier.crownShadows;
  }

  /** Frees what a level's scenery held. Shared materials and pictures stay. */
  private dispose(root: Object3D): void {
    const shared = new Set<Material>(this.materials.all());
    root.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as Material | undefined;
      if (material && !Array.isArray(material) && !shared.has(material)) material.dispose();
    });
  }

  /** A small picture of a hero for the start screen, drawn from the same model as the game. */
  portrait(heroName: HeroName, size = 192): string {
    const scene = new Scene();
    scene.environment = this.tier.simple ? null : this.assets.environment();
    scene.environmentIntensity = 1.1;
    const sun = new DirectionalLight(0xffe6bd, 2.4);
    sun.position.set(-4, 6, 8);
    scene.add(sun);
    if (this.tier.simple) scene.add(new HemisphereLight(0xfff3d6, 0x6f8f7a, 2.2));
    const hero = buildHero(heroName, this.assets, this.tier.simple);
    hero.animate({ pace: 0, grounded: true, rise: 0 }, 0);
    hero.root.rotation.y = 0.55;
    scene.add(hero.root);
    const camera = new PerspectiveCamera(32, 1, 0.1, 50);
    const { height, distance } = hero.portrait;
    camera.position.set(0.2, height + 0.25, distance * 1.75);
    camera.lookAt(0, height * 0.68, 0);
    const canvas = this.renderer.domElement;
    const ratio = this.renderer.getPixelRatio();
    const shadows = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(null);
    this.renderer.render(scene, camera);
    const picture = canvas.toDataURL('image/png');
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.size.width, this.size.height, false);
    hero.dispose();
    return picture;
  }
}
