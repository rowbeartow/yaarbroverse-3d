// Draws a boss: an enemy's model, bigger and recoloured, playing the clip for
// whatever the rules say it is doing, with its acorns and, where the level's
// difficulty asks for them, the lines its attacks are aimed along. Looks
// only: where a boss is and what it is doing come from src/game/boss.ts.

import { BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group, type Material } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOSS, acornPaths, type Boss, type BossSpot } from '../game/boss';
import { ENEMY, newEnemy, type Enemy, type EnemyPhase } from '../game/enemy';
import { ENEMY_MODELS, EnemyView, type ClipKey } from './enemies';

const ACORN_COLOR = 0x8a5a2b;
/** The most acorns a throw can have on screen. */
const MOST_ACORNS = 7;
const acornShape = new SphereGeometry(BOSS.acornRadius, 14, 10);
const laneShape = new CylinderGeometry(0.06, 0.06, 1, 6, 1, true);
const pathShape = new BoxGeometry(1, 0.04, 1);

export class BossView {
  private readonly body: EnemyView;
  private readonly acorns: Mesh[] = [];
  private readonly lanes: Mesh[] = [];
  private readonly path: Mesh;
  private readonly laneMaterial = new MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false });
  private readonly acornMaterial: Material;
  /** What the enemy drawing code is shown: an enemy standing where the boss is. */
  private readonly stand: Enemy;
  private last = { x: 0, z: 0 };
  private moving = 0;
  private clock = 0;
  private clip: ClipKey = 'idle';

  constructor(
    private readonly spot: BossSpot,
    source: GLTF,
    simple: boolean,
  ) {
    this.body = new EnemyView(ENEMY_MODELS[spot.look.model], source, simple, { scale: spot.look.scale, tint: spot.look.tint });
    this.stand = newEnemy({ id: spot.id, kind: 'marmot', x: spot.x, y: spot.y, z: spot.z, arena: spot.patch });
    this.acornMaterial = simple ? new MeshLambertMaterial({ color: ACORN_COLOR }) : new MeshStandardMaterial({ color: ACORN_COLOR, roughness: 0.6 });
    for (let i = 0; i < MOST_ACORNS; i += 1) {
      const acorn = new Mesh(acornShape, this.acornMaterial);
      acorn.scale.set(1, 1.25, 1);
      acorn.castShadow = true;
      acorn.visible = false;
      this.acorns.push(acorn);
      const lane = new Mesh(laneShape, this.laneMaterial);
      lane.visible = false;
      this.lanes.push(lane);
    }
    this.path = new Mesh(pathShape, this.laneMaterial);
    this.path.visible = false;
  }

  get root(): Group {
    return this.body.root;
  }

  /** The acorns and the aiming lines: added to the scene beside the boss itself. */
  get extras(): Mesh[] {
    return [...this.body.extras, ...this.acorns, ...this.lanes, this.path];
  }

  /** A hit just landed on it. */
  strike(): void {
    this.body.strike();
  }

  /** Which clip, and where in it, for what the boss is doing. */
  private choose(boss: Boss): { clip: ClipKey; hold?: number } {
    const n = boss.spot.numbers;
    switch (boss.phase) {
      case 'intro':
        // It rears up to its full height and holds there.
        return { clip: 'warning', hold: Math.min(1, boss.timer / 0.5) };
      case 'roar':
        return { clip: 'warning', hold: Math.min(1, boss.timer / 0.35) };
      case 'warning':
        // A charge is wound up low to the ground; a throw or a call, reared up.
        if (boss.attack === 'charge') return { clip: 'dodge', hold: 0.15 * Math.min(1, boss.timer / Math.max(n.chargeWarning * 0.6, 0.05)) };
        return { clip: 'warning', hold: Math.min(1, boss.timer / n.warning) };
      case 'attack':
        if (boss.attack === 'charge') return { clip: 'walk' };
        if (boss.attack === 'call') return { clip: 'warning', hold: 1 };
        return { clip: 'attack' };
      case 'rest':
        return { clip: 'rest' };
      case 'stagger':
        return { clip: 'hit' };
      case 'defeated':
        return { clip: 'defeated' };
      default:
        return { clip: this.moving > 0.15 ? 'walk' : 'idle' };
    }
  }

  /** Matches the picture to the rules. */
  update(boss: Boss, heroZ: number, dt: number): void {
    this.clock += dt;
    const speed = dt > 0 ? Math.hypot(boss.x - this.last.x, boss.z - this.last.z) / dt : 0;
    this.last = { x: boss.x, z: boss.z };
    this.moving += (Math.min(speed, 1.5) / 1.5 - this.moving) * (1 - Math.exp(-10 * dt));

    // The body is drawn by the enemy code, told which clip to show.
    const phase: EnemyPhase = boss.phase === 'defeated' ? 'defeated' : boss.phase === 'stagger' ? 'rest' : 'idle';
    Object.assign(this.stand, {
      x: boss.x,
      y: boss.y,
      z: boss.z,
      facing: boss.facing,
      phase,
      // A boss takes longer to go than a scout does.
      timer: boss.phase === 'defeated' ? (boss.timer * ENEMY.fade) / BOSS.fade : boss.timer,
    });
    const pose = this.choose(boss);
    this.clip = pose.clip;
    this.body.pose = pose;
    this.body.update(this.stand, { warning: 1, speed: 1, rest: 1, aimLine: false }, heroZ, dt);

    // Acorns: in the paw through the warning of a throw, then in flight.
    for (const acorn of this.acorns) acorn.visible = false;
    for (const lane of this.lanes) lane.visible = false;
    this.path.visible = false;
    if (!this.body.root.visible) return;
    const n = boss.spot.numbers;
    const warning = boss.phase === 'warning';
    if (warning && boss.attack === 'throw' && boss.timer > 0.3 * n.warning) {
      this.acorns[0].visible = true;
      this.acorns[0].position.set(boss.from.x, boss.from.y, boss.from.z);
    }
    boss.acorns.forEach((acorn, i) => {
      const mesh = this.acorns[i];
      if (!mesh || !acorn.live) return;
      mesh.visible = true;
      mesh.position.set(acorn.x, acorn.y, acorn.z);
      mesh.rotation.x += dt * 14;
    });

    // The lines its attack will follow, where the difficulty draws them: one for
    // each acorn, or the strip of ground a charge will cover.
    if (!n.aimLine || !(warning || boss.phase === 'attack')) return;
    const share = warning ? Math.min(1, boss.timer / (boss.attack === 'charge' ? n.chargeWarning : n.warning)) : 1;
    this.laneMaterial.opacity = warning ? 0.25 + 0.3 * share * (0.6 + 0.4 * Math.sin(this.clock * (10 + 20 * share))) : 0.5;
    if (boss.attack === 'throw') {
      acornPaths(boss).forEach(({ from, to }, i) => {
        const lane = this.lanes[i];
        if (!lane) return;
        const along = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
        const length = along.length();
        if (length < 1e-3) return;
        lane.visible = true;
        lane.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
        lane.scale.set(1, length, 1);
        lane.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along.normalize()));
      });
    } else if (boss.attack === 'charge') {
      const dx = boss.target.x - boss.from.x;
      const dz = boss.target.z - boss.from.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-3) return;
      this.path.visible = true;
      this.path.position.set((boss.from.x + boss.target.x) / 2, boss.y + 0.05, (boss.from.z + boss.target.z) / 2);
      this.path.rotation.y = Math.atan2(dx, dz);
      this.path.scale.set(this.spot.radius * 2, 1, length + this.spot.radius * 2);
    }
  }

  /** What is showing now, for the browser checks. */
  info(): { clip: string; visible: boolean; flashing: boolean; aimLine: boolean; acorns: number } {
    const body = this.body.info();
    return {
      clip: ENEMY_MODELS[this.spot.look.model].clips[this.clip] ?? 'idle',
      visible: body.visible,
      flashing: body.flashing,
      aimLine: this.path.visible || this.lanes.some((lane) => lane.visible),
      acorns: this.acorns.filter((acorn) => acorn.visible).length,
    };
  }

  dispose(): void {
    this.body.dispose();
    this.laneMaterial.dispose();
    this.acornMaterial.dispose();
  }
}
