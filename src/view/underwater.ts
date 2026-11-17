// The world under the water: what a swimmer sees once the camera dips below
// a pool's surface. Looks only, nothing here changes the rules.
//
//   - The surface from below: a bright window straight overhead, where the
//     sky shows through, turning to a dim mirror of the water further out, as
//     real water does past about 49 degrees. It hides everything above the
//     surface, so the sky, the hills and the log booms never show underwater.
//   - Shafts of sunlight slanting down, fixed in the water so they slide past
//     as the swimmer moves.
//   - Specks drifting in the water near the camera, which show movement and depth.
//   - On a lake's bed (`lakeBed`): rocks half buried, weed swaying, sunken logs,
//     so the bottom is a place and not one flat pattern.
//
// grove-view.ts owns the camera and the fog; each frame it calls `update` with
// where the camera is, how far under it is, and the fog it is using.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Material,
} from 'three';
import type { Level } from '../game/level';
import type { Water } from '../game/swim';
import { sways, WIND, type Materials } from './materials';
import { noise, seeded } from './noise';
import { basinMaterial, UNDERWATER_FOG } from './water';

/** How the world under the water looks. Distances are metres. */
export const UNDERWATER_LOOK = {
  /** The bright window overhead, and how sharply it gives way to the dim mirror round it (the cosines of the angle from straight up). */
  windowColor: 0xc9f2e6,
  windowFrom: 0.58,
  windowTo: 0.82,
  /** Light shafts: how far apart, on a grid fixed in the water, and how strongly they show. */
  shaftSpacing: 7,
  shaftsAcross: 5,
  shaftStrength: 0.13,
  /** Specks: how many, in a box this size round the camera. */
  specks: 420,
  speckBox: 14,
} as const;

/** The surface seen from below: a window of sky overhead, a dim rippled mirror round it, all fading into the murk. */
const ceilingMaterial = (): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uTime: WIND.time,
      uCamera: { value: new Vector3() },
      uDeep: { value: new Color(UNDERWATER_FOG) },
      uWindow: { value: new Color(UNDERWATER_LOOK.windowColor) },
      uFogNear: { value: 1 },
      uFogFar: { value: 20 },
    },
    side: DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCamera;
      uniform vec3 uDeep;
      uniform vec3 uWindow;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorld;
      void main() {
        vec3 toward = vWorld - uCamera;
        float far = length(toward);
        float up = clamp(toward.y / max(far, 0.001), 0.0, 1.0);
        // Snell's window: sky straight overhead, a dim mirror of the water further out.
        float window = smoothstep(${UNDERWATER_LOOK.windowFrom.toFixed(2)}, ${UNDERWATER_LOOK.windowTo.toFixed(2)}, up);
        vec2 p = vWorld.xz * 0.8;
        float t = uTime * 0.6;
        float ripple = abs(sin(p.x * 1.7 + sin(p.y * 1.3 + t) * 1.4 + t)) * abs(sin(p.y * 2.0 + sin(p.x * 1.1 - t * 0.8) * 1.2 - t * 0.7));
        ripple = pow(1.0 - ripple, 5.0);
        vec3 mirror = uDeep * 1.35;
        vec3 color = mix(mirror, uWindow, window) + vec3(0.6, 0.9, 0.85) * ripple * (0.12 + 0.3 * window);
        color = mix(color, uDeep, smoothstep(uFogNear, uFogFar, far));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

/** A soft shaft of light: bright at the top, fading downward and at both sides. */
const shaftPicture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const image = context.createImageData(32, 128);
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const across = Math.sin((x / 31) * Math.PI);
      const down = Math.pow(1 - y / 127, 1.4);
      const value = Math.round(255 * across * across * down);
      const at = (y * 32 + x) * 4;
      image.data[at] = image.data[at + 1] = image.data[at + 2] = value;
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return new CanvasTexture(canvas);
};

/** A whole number from a grid cell, for placing things the same way every time the cell comes round. */
const cellHash = (i: number, k: number): number => {
  const h = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/** The parts of the underwater look that go with the camera: the surface from below, the shafts and the specks. */
export class UnderwaterView {
  readonly group = new Group();
  private readonly ceiling: Mesh;
  private readonly ceilingLook: ShaderMaterial;
  private readonly shafts: InstancedMesh;
  private readonly shaftAt = { m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(), e: new Euler() };
  private readonly shaftLook: MeshBasicMaterial;
  private readonly specks: Points;
  private readonly speckLook: PointsMaterial;
  private readonly speckHome: Float32Array;
  private readonly materials: Material[] = [];

  constructor(private readonly waters: readonly Water[], simple: boolean) {
    this.ceilingLook = ceilingMaterial();
    this.materials.push(this.ceilingLook);
    // Wide enough that its edge is always lost in the murk.
    this.ceiling = new Mesh(new PlaneGeometry(600, 600), this.ceilingLook);
    this.ceiling.rotation.x = Math.PI / 2;
    this.ceiling.name = 'underwater-surface';
    this.ceiling.frustumCulled = false;
    this.group.add(this.ceiling);

    this.shaftLook = new MeshBasicMaterial({ map: shaftPicture(), color: 0xc6f1e4, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });
    this.materials.push(this.shaftLook);
    const across = simple ? 3 : UNDERWATER_LOOK.shaftsAcross;
    // One draw for all of them.
    this.shafts = new InstancedMesh(new PlaneGeometry(1, 1), this.shaftLook, across * across);
    this.shafts.renderOrder = 4;
    this.shafts.frustumCulled = false;
    this.group.add(this.shafts);

    const count = simple ? Math.round(UNDERWATER_LOOK.specks / 2) : UNDERWATER_LOOK.specks;
    const random = seeded(71);
    this.speckHome = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 1) this.speckHome[i] = random() * UNDERWATER_LOOK.speckBox;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    this.speckLook = new PointsMaterial({ color: 0xd8f0e6, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false });
    this.materials.push(this.speckLook);
    this.specks = new Points(geometry, this.speckLook);
    this.specks.frustumCulled = false;
    this.group.add(this.specks);
    this.group.visible = false;
  }

  /** The pool the point is in, if any. */
  private poolAt(x: number, z: number): Water | undefined {
    return this.waters.find((w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ);
  }

  /**
   * Puts everything where the camera is. `share` is how far into the
   * underwater look the picture is (0 above, 1 under); `fogNear` and `fogFar`
   * are the fog the scene is using.
   */
  update(camera: Vector3, share: number, fogNear: number, fogFar: number, time: number): void {
    const pool = this.poolAt(camera.x, camera.z);
    const under = share > 0.01 && pool !== undefined && camera.y < pool.surface;
    this.group.visible = under;
    if (!under || !pool) return;
    const u = this.ceilingLook.uniforms;
    (u.uCamera.value as Vector3).copy(camera);
    u.uFogNear.value = fogNear;
    u.uFogFar.value = fogFar;
    // Just under the lowest a wave dips, so the surface's troughs never show through it from below.
    this.ceiling.position.set(camera.x, pool.surface - 0.09, camera.z);

    // Shafts on a grid fixed in the water: the ones in the cells round the camera.
    const spacing = UNDERWATER_LOOK.shaftSpacing;
    const across = Math.round(Math.sqrt(this.shafts.count));
    const ci = Math.floor(camera.x / spacing) - Math.floor(across / 2);
    const ck = Math.floor(camera.z / spacing) - Math.floor(across / 2);
    const depth = pool.surface - pool.floor;
    const { m, q, p, s, e } = this.shaftAt;
    for (let n = 0; n < this.shafts.count; n += 1) {
      const i = ci + (n % across);
      const k = ck + Math.floor(n / across);
      const h = cellHash(i, k);
      // Some cells have none, so they do not stand in rows.
      const shown = cellHash(i * 3, k * 7) > 0.25;
      s.set(shown ? 1.2 + h * 2.2 : 0, depth * 1.25, 1);
      p.set((i + 0.2 + h * 0.6) * spacing, pool.surface - depth * 0.6, (k + 0.2 + cellHash(k, i) * 0.6) * spacing);
      // Slanting the way the sun comes, each turned to face the camera.
      q.setFromEuler(e.set(0, Math.atan2(camera.x - p.x, camera.z - p.z), 0.3));
      this.shafts.setMatrixAt(n, m.compose(p, q, s));
    }
    this.shafts.instanceMatrix.needsUpdate = true;
    this.shaftLook.opacity = share * (UNDERWATER_LOOK.shaftStrength + Math.sin(time * 0.8) * 0.03);

    // Specks: each keeps its place in a box that moves with the camera, drifting slowly.
    const box = UNDERWATER_LOOK.speckBox;
    const positions = this.specks.geometry.getAttribute('position') as BufferAttribute;
    const array = positions.array as Float32Array;
    const wrap = (value: number, middle: number): number => middle - box / 2 + ((((value - (middle - box / 2)) % box) + box) % box);
    for (let i = 0; i < array.length; i += 3) {
      const x = wrap(this.speckHome[i] + time * 0.12, camera.x);
      const y = Math.min(pool.surface - 0.05, Math.max(pool.floor - 0.2, wrap(this.speckHome[i + 1] + Math.sin(time * 0.3 + i) * 0.3, camera.y)));
      const z = wrap(this.speckHome[i + 2] + time * 0.05, camera.z);
      array[i] = x;
      array[i + 1] = y;
      array[i + 2] = z;
    }
    positions.needsUpdate = true;
    this.speckLook.opacity = 0.55 * share;
  }

  dispose(): void {
    this.ceiling.geometry.dispose();
    this.shafts.geometry.dispose();
    this.specks.geometry.dispose();
    this.shaftLook.map?.dispose();
    for (const material of this.materials) material.dispose();
  }
}

/** How many of each thing the lake bed carries, for each 100 square metres of water. */
const BED = { rocks: 1.4, weeds: 2, logs: 0.12 } as const;

/**
 * Dressing for a lake's bed: rocks half buried, weed in clumps that sway,
 * and sunken logs, inside the level's pools and clear of its solids. They stay
 * below the deepest a swimmer goes, so nothing a hero swims through looks solid.
 * Three draws in all.
 */
export const lakeBed = (level: Level, materials: Materials, bedY: number, simple: boolean): Group => {
  const group = new Group();
  group.name = 'lake-bed';
  const random = seeded(913);
  const pools = level.water ?? [];
  const surface = pools[0]?.surface ?? 0;
  const clear = (x: number, z: number, margin: number): boolean =>
    !level.solids.some((s) => s.bottom <= surface && (s.shape === 'round' ? Math.hypot(x - s.x, z - s.z) < s.halfX + margin : Math.abs(x - s.x) < s.halfX + margin && Math.abs(z - s.z) < s.halfZ + margin));
  /** A spot in a pool, chosen by area, clear of solids; null if none found. */
  const spot = (margin: number): { x: number; z: number; floor: number } | null => {
    const areas = pools.map((p) => (p.maxX - p.minX) * (p.maxZ - p.minZ));
    const total = areas.reduce((a, b) => a + b, 0);
    for (let tries = 0; tries < 8; tries += 1) {
      let pick = random() * total;
      const pool = pools[Math.max(0, areas.findIndex((a) => (pick -= a) < 0))];
      const x = pool.minX + 0.5 + random() * (pool.maxX - pool.minX - 1);
      const z = pool.minZ + 0.5 + random() * (pool.maxZ - pool.minZ - 1);
      if (clear(x, z, margin)) return { x, z, floor: pool.floor };
    }
    return null;
  };
  const area = pools.reduce((sum, p) => sum + (p.maxX - p.minX) * (p.maxZ - p.minZ), 0) / 100;
  const scale = simple ? 0.5 : 1;
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const up = new Vector3(0, 1, 0);

  // Rocks: lumpy, half buried, their tops under the deepest a swimmer goes.
  const rockShape = new IcosahedronGeometry(1, 1);
  const corners = rockShape.getAttribute('position');
  for (let i = 0; i < corners.count; i += 1) {
    const v = new Vector3().fromBufferAttribute(corners, i);
    v.multiplyScalar(0.78 + 0.32 * noise(v.x * 1.7, v.y * 1.7, v.z * 1.7));
    corners.setXYZ(i, v.x, v.y * 0.7, v.z);
  }
  rockShape.computeVertexNormals();
  const rockLook = basinMaterial(materials.rock, surface);
  const rockCount = Math.round(area * BED.rocks * scale);
  const rocks = new InstancedMesh(rockShape, rockLook, Math.max(1, rockCount));
  let placed = 0;
  for (let i = 0; i < rockCount; i += 1) {
    const at = spot(1.5);
    if (!at) continue;
    const size = 0.35 + random() ** 2 * 1.1;
    q.setFromAxisAngle(up, random() * Math.PI * 2);
    // Buried so its top sits a little under the swimmers' floor.
    p.set(at.x, Math.min(at.floor - 0.15 - size * 0.7, bedY + size * 0.25), at.z);
    s.set(size * (0.8 + random() * 0.6), size, size * (0.8 + random() * 0.6));
    rocks.setMatrixAt(placed, m.compose(p, q, s));
    placed += 1;
  }
  rocks.count = placed;
  rocks.receiveShadow = true;
  group.add(rocks);

  // Weed: tall ribbons in clumps, swaying slowly as the water moves.
  const ribbon = new PlaneGeometry(0.09, 1, 1, 5);
  ribbon.translate(0, 0.5, 0);
  // Narrowing to a tip, and leaning over a little, as weed does.
  const ribbonPoints = ribbon.getAttribute('position');
  for (let i = 0; i < ribbonPoints.count; i += 1) {
    const y = ribbonPoints.getY(i);
    ribbonPoints.setX(i, ribbonPoints.getX(i) * (1 - y * 0.75) + y * y * 0.18);
  }
  ribbon.computeVertexNormals();
  const sway = new Float32Array(ribbon.getAttribute('position').count);
  for (let i = 0; i < sway.length; i += 1) sway[i] = ribbon.getAttribute('position').getY(i) ** 1.5;
  ribbon.setAttribute('sway', new Float32BufferAttribute(sway, 1));
  const weedLook = sways(new MeshLambertMaterial({ color: 0xffffff, emissive: 0x0b1a0d, side: DoubleSide }), 0.3, 0.35);
  const weedCount = Math.round(area * BED.weeds * scale) * 5;
  const weeds = new InstancedMesh(ribbon, weedLook, Math.max(1, weedCount));
  const tint = new Color();
  const greens = [0x587f3a, 0x4a7034, 0x66873e, 0x52763a];
  placed = 0;
  for (let c = 0; c < weedCount / 5; c += 1) {
    const at = spot(1.2);
    if (!at) continue;
    // Below the depth swimmers keep to, so weed never stands between the camera and the hero.
    const tall = 0.5 + random() * 0.8;
    for (let k = 0; k < 5 && placed < weedCount; k += 1) {
      q.setFromAxisAngle(up, random() * Math.PI);
      p.set(at.x + (random() - 0.5) * 0.9, bedY, at.z + (random() - 0.5) * 0.9);
      s.set(1, tall * (0.6 + random() * 0.5), 1);
      weeds.setMatrixAt(placed, m.compose(p, q, s));
      weeds.setColorAt(placed, tint.setHex(greens[Math.floor(random() * greens.length)]));
      placed += 1;
    }
  }
  weeds.count = placed;
  group.add(weeds);

  // Sunken logs, lying on the bed, grey with age.
  const logShape = new CylinderGeometry(0.28, 0.32, 1, 9, 1);
  logShape.rotateZ(Math.PI / 2);
  const logLook = basinMaterial(materials.bark, surface);
  const logCount = Math.max(2, Math.round(area * BED.logs * scale));
  const logs = new InstancedMesh(logShape, logLook, logCount);
  placed = 0;
  for (let i = 0; i < logCount; i += 1) {
    const at = spot(3);
    if (!at) continue;
    q.setFromAxisAngle(up, random() * Math.PI);
    p.set(at.x, Math.min(at.floor - 0.35, bedY + 0.2), at.z);
    s.set(3 + random() * 4, 1, 1);
    logs.setMatrixAt(placed, m.compose(p, q, s));
    placed += 1;
  }
  logs.count = placed;
  logs.receiveShadow = true;
  group.add(logs);
  return group;
};
