// Draws the game: builds the scene for a level and hero, then each frame moves
// the hero's shapes, the shadow and the camera to match the game rules' state.

import {
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Mesh,
} from 'three';
import type { Game, GameEvent } from '../game/game';
import { MOVE, type HeroName } from '../game/hero';
import { surfaceBelow, type Level } from '../game/level';
import { buildHero, type HeroView } from './heroes';
import { animateMushroom, blobShadow, buildLevelView, type LevelView } from './scenery';
import { COLOR, disposeTree, skyTexture } from './shapes';

/** Where the camera sits relative to the hero: behind, above, looking ahead and down. */
const CAMERA = { back: 12, up: 8, lookAhead: 4.5, lookUp: 1, fieldOfView: 50 };

const ease = (from: number, to: number, rate: number, dt: number): number =>
  from + (to - from) * (1 - Math.exp(-rate * dt));

export class GroveView {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA.fieldOfView, 1, 0.1, 500);
  private readonly shadow: Mesh = blobShadow();
  private levelView: LevelView | null = null;
  private hero: HeroView | null = null;
  private level: Level | null = null;
  private follow = { x: 0, y: 0, z: 0 };
  private lowestGround = 0;
  private clock = 0;
  private sinceGoal = -1;
  private blink = 0;

  constructor(canvas: HTMLCanvasElement) {
    // Throws if the browser cannot draw 3D; main.ts shows a plain message then.
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = skyTexture();
    this.scene.fog = new Fog(COLOR.mist, 30, 125);
    this.scene.add(new HemisphereLight(0xfff6dc, 0x4f7f6a, 2.1));
    const sun = new DirectionalLight(0xffe6b0, 2.4);
    sun.position.set(-9, 14, 7);
    this.scene.add(sun);
    this.scene.add(this.shadow);
  }

  /** Builds the scene for a level and hero, replacing whatever was shown before. */
  show(level: Level, heroName: HeroName): void {
    if (this.levelView) {
      this.scene.remove(this.levelView.group);
      disposeTree(this.levelView.group);
    }
    if (this.hero) {
      this.scene.remove(this.hero.root);
      disposeTree(this.hero.root);
    }
    this.level = level;
    this.levelView = buildLevelView(level);
    this.hero = buildHero(heroName);
    this.scene.add(this.levelView.group, this.hero.root);
    this.lowestGround = Math.min(...level.solids.map((s) => s.top));
    this.follow = { ...level.spawn };
    this.sinceGoal = -1;
    this.blink = 0;
    this.shadow.scale.set(this.hero.shadow.across, this.hero.shadow.along, 1);
  }

  /** Reacts to what just happened in the rules: squash a mushroom, stretch the hero, and so on. */
  handle(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'bounce') {
        const mushroom = this.levelView?.mushrooms.get(event.solidId);
        if (mushroom) mushroom.sinceBounce = 0;
        this.hero?.squash(-0.25);
      } else if (event.type === 'jump') this.hero?.squash(-0.18);
      else if (event.type === 'land') this.hero?.squash(0.22);
      else if (event.type === 'fall') {
        this.blink = MOVE.returnPause;
      } else if (event.type === 'goal') this.sinceGoal = 0;
    }
  }

  /**
   * Draws one frame. `before` is where the hero was one rules step ago and
   * `blend` how far between that and now the screen is, so motion stays smooth
   * on screens faster than the rules' 60 steps a second.
   */
  frame(game: Game, before: { x: number; y: number; z: number }, blend: number, dt: number): void {
    const { hero, levelView, level } = this;
    if (!hero || !levelView || !level) return;
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
      },
      dt,
    );
    this.blink = Math.max(0, this.blink - dt);
    hero.root.visible = this.blink <= 0 || Math.floor(this.blink * 12) % 2 === 0;

    // The shadow drops straight down onto whatever is below. No ground, no shadow.
    const ground = surfaceBelow(level, x, z, y + level.ledgeHelp, MOVE.footRadius);
    this.shadow.visible = ground !== null;
    if (ground) {
      const height = Math.max(y - ground.top, 0);
      const shrink = 1 / (1 + height * 0.12);
      this.shadow.position.set(x, ground.top + 0.03, z);
      this.shadow.rotation.z = hero.root.rotation.y;
      this.shadow.scale.set(hero.shadow.across * shrink, hero.shadow.along * shrink, 1);
    }

    // Mushrooms and the golden leaf.
    for (const mushroom of levelView.mushrooms.values()) animateMushroom(mushroom, dt);
    const leaf = levelView.leaf;
    if (this.sinceGoal >= 0) {
      this.sinceGoal += dt;
      const t = Math.min(this.sinceGoal / 1.2, 1);
      leaf.blade.rotation.y += dt * (6 + t * 18);
      leaf.group.position.y = leaf.baseY + t * 1.6;
      leaf.blade.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.9);
      leaf.halo.scale.setScalar(3.4 + t * 5);
    } else {
      leaf.blade.rotation.y += dt * 1.6;
      leaf.group.position.y = leaf.baseY + Math.sin(this.clock * 2) * 0.12;
      leaf.blade.scale.setScalar(1);
      leaf.halo.scale.setScalar(3.4 + Math.sin(this.clock * 3) * 0.3);
    }

    // Camera: follow smoothly, slower up and down so jumps do not shake the view,
    // and never chase a falling hero into the mist.
    const followY = Math.max(y, this.lowestGround - 0.5);
    this.follow.x = ease(this.follow.x, x, 7, dt);
    this.follow.z = ease(this.follow.z, z, 7, dt);
    this.follow.y = ease(this.follow.y, followY, game.grounded ? 5 : 2.6, dt);
    this.aimCamera();
    this.renderer.render(this.scene, this.camera);
  }

  /** Puts the camera straight on the hero, with no easing (after a restart). */
  snapCamera(game: Game): void {
    this.follow = { x: game.x, y: game.y, z: game.z };
    if (this.hero) this.hero.root.rotation.y = game.facing;
  }

  private aimCamera(): void {
    const { x, y, z } = this.follow;
    this.camera.position.set(x * 0.85, y + CAMERA.up, z + CAMERA.back);
    this.camera.lookAt(x * 0.92, y + CAMERA.lookUp, z - CAMERA.lookAhead);
  }

  /** Matches the drawing size to the window. */
  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    // On a tall, narrow window keep the sides in view by widening the angle a little.
    this.camera.fov = this.camera.aspect < 1.5 ? CAMERA.fieldOfView + (1.5 - this.camera.aspect) * 14 : CAMERA.fieldOfView;
    this.camera.updateProjectionMatrix();
  }

  /** A small picture of a hero for the start screen, drawn with the same shapes as the game. */
  portrait(heroName: HeroName, size = 192): string {
    const scene = new Scene();
    scene.add(new HemisphereLight(0xfff6dc, 0x6f8f7a, 2.3));
    const sun = new DirectionalLight(0xffe6b0, 2.2);
    sun.position.set(-4, 6, 8);
    scene.add(sun);
    const hero = buildHero(heroName);
    hero.animate({ pace: 0, grounded: true, rise: 0 }, 0);
    hero.root.rotation.y = 0.55;
    const stage = new Group();
    stage.add(hero.root);
    scene.add(stage);
    const camera = new PerspectiveCamera(32, 1, 0.1, 50);
    const { height, distance } = hero.portrait;
    camera.position.set(0.2, height + 0.25, distance * 1.75);
    camera.lookAt(0, height * 0.68, 0);
    const canvas = this.renderer.domElement;
    const previous = { width: canvas.width, height: canvas.height, ratio: this.renderer.getPixelRatio() };
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(scene, camera);
    const picture = canvas.toDataURL('image/png');
    this.renderer.setPixelRatio(previous.ratio);
    this.renderer.setSize(previous.width / previous.ratio, previous.height / previous.ratio, false);
    disposeTree(stage);
    return picture;
  }
}
