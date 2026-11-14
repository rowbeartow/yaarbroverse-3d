// How water looks: each pool's surface with gentle waves, its basin (rock
// sides and a floor, with light from above rippling over them), splashes,
// rings on the surface, and bubbles. Looks only: the rules are in
// src/game/swim.ts, and nothing here changes them.
//
// The look underwater (the colour shift, the closer fog, the camera dipping
// under the surface) is in grove-view.ts, which owns the camera and the fog;
// it asks `underwaterLook` here how far under the camera is.

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import type { Water } from '../game/swim';
import { WIND, type Lit, type Materials } from './materials';

/** The colour of the water seen into, and of the fog underwater. */
export const WATER_COLOR = 0x2f6e6c;
export const UNDERWATER_FOG = 0x24585c;

/** Gentle waves: their height and length (metres) and speed. Shared by the surface's shader and `waveAt`. */
const WAVES = [
  { x: 0.8, z: 0.6, length: 3.1, height: 0.035, speed: 0.9 },
  { x: -0.5, z: 0.85, length: 1.9, height: 0.022, speed: 1.3 },
  { x: 0.2, z: -1, length: 1.1, height: 0.012, speed: 1.9 },
] as const;

/** How high the waves stand at (x, z) at this moment, above the still surface. */
export const waveAt = (x: number, z: number, time: number): number => {
  let y = 0;
  for (const w of WAVES) {
    const k = (Math.PI * 2) / w.length;
    const along = (w.x * x + w.z * z) / Math.hypot(w.x, w.z);
    y += Math.sin(along * k + time * w.speed * 2) * w.height;
  }
  return y;
};

const wavesGlsl = (): string =>
  WAVES.map((w) => {
    const size = Math.hypot(w.x, w.z);
    const k = ((Math.PI * 2) / w.length).toFixed(4);
    return `{ float a = dot(p, vec2(${(w.x / size).toFixed(4)}, ${(w.z / size).toFixed(4)})) * ${k} + uTime * ${(w.speed * 2).toFixed(3)};
      h += sin(a) * ${w.height.toFixed(4)};
      g += cos(a) * ${k} * ${w.height.toFixed(4)} * vec2(${(w.x / size).toFixed(4)}, ${(w.z / size).toFixed(4)}); }`;
  }).join('\n');

/** The water's surface: see-through, glossy, with gentle waves moving across it. */
const surfaceMaterial = (simple: boolean): Material => {
  const material = simple
    ? new MeshLambertMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.62, side: DoubleSide, depthWrite: false })
    : new MeshStandardMaterial({ color: WATER_COLOR, roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false, envMapIntensity: 1.4 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WIND.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec2 p = (modelMatrix * vec4(position, 1.0)).xz;
          float h = 0.0; vec2 g = vec2(0.0);
          ${wavesGlsl()}
          transformed.z += h;
          objectNormal = normalize(vec3(-g.x, g.y, 1.0));
        }`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 0.0, 1.0);')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>');
  };
  material.customProgramCacheKey = () => `water-surface:${simple}`;
  return material;
};

/**
 * Rock for a pool's sides and floor, with light from above rippling over it
 * below the surface: bright threads that drift, as sunlight through waves does.
 */
const basinMaterial = (rock: Lit, surface: number): Lit => {
  const material = rock.clone();
  const before = rock.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.uTime = WIND.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;\nuniform float uTime;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        {
          float depth = ${surface.toFixed(3)} - vWaterWorld.y;
          if (depth > 0.0) {
            // Height is mixed in, so the pattern does not smear into streaks down the pool's sides.
            vec2 p = (vWaterWorld.xz + vec2(vWaterWorld.y * 1.7, -vWaterWorld.y * 1.3)) * 1.3;
            float t = uTime * 0.7;
            float c = abs(sin(p.x * 2.1 + sin(p.y * 1.7 + t) * 1.3 + t)) * abs(sin(p.y * 2.4 + sin(p.x * 1.4 - t * 0.8) * 1.2 - t * 0.6));
            c = pow(1.0 - c, 7.0);
            float fade = exp(-depth * 0.28);
            vec3 tint = vec3(0.16, 0.42, 0.44);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * tint * 1.6, min(depth * 0.6, 0.75));
            gl_FragColor.rgb += vec3(0.55, 0.85, 0.8) * c * 0.5 * fade;
          }
        }`,
      );
  };
  material.customProgramCacheKey = () => `basin:${surface.toFixed(3)}:${rock.customProgramCacheKey()}`;
  return material;
};

/** One pool, drawn. */
interface PoolView {
  water: Water;
  surface: Mesh;
}

/** Up to this many droplets and bubbles at once, and this many rings on the surface. */
const DROPS = 96;
const RINGS = 12;

interface Drop {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds left, and how big. */
  life: number;
  size: number;
  /** A bubble rises and wobbles until it reaches the surface; a droplet falls. */
  bubble: boolean;
  /** The surface it stops at (bubbles), or splashes back into (droplets). */
  surface: number;
}

interface Ring {
  mesh: Mesh;
  age: number;
  life: number;
  size: number;
}

const hidden = new Matrix4().makeScale(0, 0, 0);

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
      const down = Math.pow(1 - y / 127, 1.6);
      const value = Math.round(255 * across * across * down);
      const at = (y * 32 + x) * 4;
      image.data[at] = image.data[at + 1] = image.data[at + 2] = value;
      image.data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  return texture;
};

export class WaterView {
  readonly group = new Group();
  private readonly pools: PoolView[] = [];
  private readonly drops: Drop[] = [];
  private readonly dropMesh: InstancedMesh;
  private readonly rings: Ring[] = [];
  private nextRing = 0;
  private readonly materials: Material[] = [];
  private readonly scratch = { m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3() };

  constructor(waters: readonly Water[], materials: Materials, private readonly simple: boolean) {
    const surfaceLook = surfaceMaterial(simple);
    this.materials.push(surfaceLook);
    for (const water of waters) {
      const width = water.maxX - water.minX;
      const length = water.maxZ - water.minZ;
      const middle = { x: (water.minX + water.maxX) / 2, z: (water.minZ + water.maxZ) / 2 };
      // The surface: about four points to a metre, so the waves are smooth.
      const surface = new Mesh(new PlaneGeometry(width, length, Math.ceil(width * 3), Math.ceil(length * 3)), surfaceLook);
      surface.rotation.x = -Math.PI / 2;
      surface.position.set(middle.x, water.surface, middle.z);
      surface.renderOrder = 2;
      surface.name = `water:${water.id}`;
      this.group.add(surface);
      // The basin: a floor and four sides of rock, holding the water in.
      const rock = basinMaterial(materials.rock, water.surface);
      this.materials.push(rock);
      const depth = water.surface - water.floor;
      const wall = 0.6;
      const floor = new Mesh(new BoxGeometry(width + wall * 2, 0.8, length + wall * 2), rock);
      floor.position.set(middle.x, water.floor - 0.4, middle.z);
      floor.receiveShadow = true;
      this.group.add(floor);
      const sides: Array<[number, number, number, number]> = [
        [water.minX - wall / 2, middle.z, wall, length + wall * 2],
        [water.maxX + wall / 2, middle.z, wall, length + wall * 2],
        [middle.x, water.minZ - wall / 2, width, wall],
        [middle.x, water.maxZ + wall / 2, width, wall],
      ];
      for (const [x, z, w, l] of sides) {
        const side = new Mesh(new BoxGeometry(w, depth + 1.2, l), rock);
        side.position.set(x, water.floor - 0.8 + (depth + 1.2) / 2 + 0.02, z);
        side.receiveShadow = true;
        this.group.add(side);
      }
      this.pools.push({ water, surface });
    }
    // Droplets and bubbles: one shape drawn many times.
    const dropLook = new MeshBasicMaterial({ color: 0xdff6f2, transparent: true, opacity: 0.55, depthWrite: false });
    this.materials.push(dropLook);
    this.dropMesh = new InstancedMesh(new SphereGeometry(1, 6, 4), dropLook, DROPS);
    this.dropMesh.frustumCulled = false;
    for (let i = 0; i < DROPS; i += 1) this.dropMesh.setMatrixAt(i, hidden);
    this.dropMesh.count = DROPS;
    this.group.add(this.dropMesh);
    // Rings: flat, pale, spreading and fading on the surface.
    const ringShape = new RingGeometry(0.82, 1, 32);
    for (let i = 0; i < RINGS; i += 1) {
      const look = new MeshBasicMaterial({ color: 0xeafcf7, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
      this.materials.push(look);
      const mesh = new Mesh(ringShape, look);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.rings.push({ mesh, age: 0, life: 0, size: 1 });
    }
    // Shafts of light slanting down from the surface, seen only from underwater.
    const shaftLook = new MeshBasicMaterial({ map: shaftPicture(), color: 0xbfeee4, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });
    this.materials.push(shaftLook);
    this.shaftLook = shaftLook;
    for (const { water } of this.pools) {
      const depth = water.surface - water.floor;
      const area = (water.maxX - water.minX) * (water.maxZ - water.minZ);
      const count = Math.min(8, Math.max(2, Math.round(area / 24)));
      for (let i = 0; i < count; i += 1) {
        const width = 1.8 + ((i * 7) % 5) * 0.4;
        const shaft = new Mesh(new PlaneGeometry(width, depth * 1.1), shaftLook);
        const u = ((i * 0.618) % 1);
        const v = ((i * 0.381 + 0.2) % 1);
        shaft.position.set(water.minX + 0.5 + u * (water.maxX - water.minX - 1), water.surface - depth * 0.55, water.minZ + 0.5 + v * (water.maxZ - water.minZ - 1));
        // Slanting the way the sun comes from (from the left and behind the camera).
        shaft.rotation.set(0, (i % 3) * 0.6, 0.32);
        shaft.renderOrder = 4;
        this.shafts.add(shaft);
      }
    }
    this.shafts.visible = false;
    this.group.add(this.shafts);
  }

  private readonly shafts = new Group();
  private readonly shaftLook: MeshBasicMaterial;

  /** How strongly the underwater things (the light shafts) show: 0 above water, 1 under. */
  setUnder(share: number, time: number): void {
    this.shafts.visible = share > 0.01;
    this.shaftLook.opacity = share * (0.07 + Math.sin(time * 0.8) * 0.02);
  }

  /** What the browser checks can ask: how many pools are drawn, and how many droplets, bubbles and rings show now. */
  info(): { pools: number; drops: number; rings: number } {
    return { pools: this.pools.length, drops: this.drops.length, rings: this.rings.filter((ring) => ring.mesh.visible).length };
  }

  /** The still surface's height at (x, z) if a pool is there, else null. */
  surfaceAt(x: number, z: number): number | null {
    for (const { water } of this.pools) if (x >= water.minX && x <= water.maxX && z >= water.minZ && z <= water.maxZ) return water.surface;
    return null;
  }

  /** A ring spreading on the surface at (x, z), up to `size` metres across. */
  ring(x: number, z: number, size: number, life = 1.1): void {
    const surface = this.surfaceAt(x, z);
    if (surface === null) return;
    const ring = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % RINGS;
    ring.mesh.position.set(x, surface + waveAt(x, z, WIND.time.value) + 0.02, z);
    ring.age = 0;
    ring.life = life;
    ring.size = size;
    ring.mesh.visible = true;
  }

  /** Droplets thrown up from (x, z): `strength` 0 to 1. */
  splash(x: number, z: number, strength: number): void {
    const surface = this.surfaceAt(x, z);
    if (surface === null) return;
    const count = Math.round(6 + strength * 26);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const out = 0.6 + Math.random() * 1.8 * (0.5 + strength);
      this.add({
        x: x + Math.cos(angle) * 0.3,
        y: surface + 0.05,
        z: z + Math.sin(angle) * 0.3,
        vx: Math.cos(angle) * out,
        vy: 1.5 + Math.random() * (2 + strength * 5),
        vz: Math.sin(angle) * out,
        life: 1.6,
        size: 0.035 + Math.random() * 0.05,
        bubble: false,
        surface,
      });
    }
    this.ring(x, z, 1.4 + strength * 2.6, 1.3);
    if (strength > 0.35) this.ring(x, z, 0.8 + strength * 1.6, 0.9);
  }

  /** A few bubbles from a swimmer underwater at (x, y, z). */
  bubbles(x: number, y: number, z: number, count = 2): void {
    const surface = this.surfaceAt(x, z);
    if (surface === null) return;
    for (let i = 0; i < count; i += 1) {
      this.add({
        x: x + (Math.random() - 0.5) * 0.3,
        y,
        z: z + (Math.random() - 0.5) * 0.3,
        vx: 0,
        vy: 0.7 + Math.random() * 0.5,
        vz: 0,
        life: 6,
        size: 0.018 + Math.random() * 0.025,
        bubble: true,
        surface,
      });
    }
  }

  /** Drips falling from a hero climbing out at (x, y, z). */
  drips(x: number, y: number, z: number, count = 6): void {
    for (let i = 0; i < count; i += 1) {
      this.add({
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + Math.random() * 1.2,
        z: z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: Math.random() * 0.5,
        vz: (Math.random() - 0.5) * 0.4,
        life: 1,
        size: 0.03,
        bubble: false,
        surface: -Infinity,
      });
    }
  }

  private add(drop: Drop): void {
    if (this.drops.length >= DROPS) this.drops.shift();
    this.drops.push(drop);
  }

  /** Moves everything on by `dt`. `time` is the wave clock. */
  update(dt: number): void {
    const { m, q, p, s } = this.scratch;
    for (let i = this.drops.length - 1; i >= 0; i -= 1) {
      const d = this.drops[i];
      d.life -= dt;
      if (d.bubble) {
        d.x += Math.sin(d.life * 7 + i) * 0.15 * dt;
        d.y += d.vy * dt;
        if (d.y >= d.surface) {
          // A bubble that reaches the surface leaves a tiny ring.
          if (Math.random() < 0.25) this.ring(d.x, d.z, 0.35, 0.6);
          d.life = 0;
        }
      } else {
        d.vy -= 9.8 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        if (d.vy < 0 && d.y < d.surface) d.life = 0;
      }
      if (d.life <= 0) this.drops.splice(i, 1);
    }
    for (let i = 0; i < DROPS; i += 1) {
      const d = this.drops[i];
      if (!d) {
        this.dropMesh.setMatrixAt(i, hidden);
        continue;
      }
      p.set(d.x, d.y, d.z);
      s.setScalar(d.size);
      this.dropMesh.setMatrixAt(i, m.compose(p, q, s));
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;
    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.mesh.visible = false;
        continue;
      }
      const r = 0.2 + (ring.size / 2) * (1 - (1 - t) * (1 - t));
      ring.mesh.scale.set(r, r, 1);
      (ring.mesh.material as MeshBasicMaterial).opacity = (1 - t) * (this.simple ? 0.4 : 0.32);
    }
  }

  dispose(): void {
    this.group.traverse((part) => {
      if (part instanceof Mesh) part.geometry.dispose();
    });
    this.shaftLook.map?.dispose();
    for (const material of this.materials) material.dispose();
  }
}

/**
 * How far under a pool's surface the camera is, in metres (0 when above, or
 * over no pool), for the look underwater.
 */
export const underwaterDepth = (waters: readonly Water[] | undefined, x: number, y: number, z: number): number => {
  for (const water of waters ?? []) {
    if (x >= water.minX && x <= water.maxX && z >= water.minZ && z <= water.maxZ && y < water.surface && y > water.floor - 1) return water.surface - y;
  }
  return 0;
};

/**
 * The highest the camera may be at (x, z) underwater: just under the pool's
 * surface, and under the underside of anything over the water there (an arch).
 */
export const underwaterCeiling = (water: Water, solids: readonly { x: number; z: number; halfX: number; halfZ: number; bottom: number; top: number; shape: string }[], x: number, z: number, margin = 0.35): number => {
  let ceiling = water.surface - margin;
  for (const s of solids) {
    // Only something over the water with water under it (an arch): not a bank beside the pool.
    if (s.bottom >= water.surface || s.bottom <= water.floor) continue;
    const inside = s.shape === 'round' ? Math.hypot(x - s.x, z - s.z) < s.halfX + 0.6 : Math.abs(x - s.x) < s.halfX + 0.6 && Math.abs(z - s.z) < s.halfZ + 0.6;
    if (inside) ceiling = Math.min(ceiling, s.bottom - margin);
  }
  return ceiling;
};

/** True when a point is inside (or within `margin` of) any solid: a camera there would show only rock. */
export const insideSolid = (solids: readonly { x: number; z: number; halfX: number; halfZ: number; bottom: number; top: number; shape: string; gone?: boolean }[], x: number, y: number, z: number, margin = 0.3): boolean =>
  solids.some((s) => {
    if (s.gone || y < s.bottom - margin || y > s.top + margin) return false;
    if (s.shape === 'round') return Math.hypot(x - s.x, z - s.z) < s.halfX + margin;
    return Math.abs(x - s.x) < s.halfX + margin && Math.abs(z - s.z) < s.halfZ + margin;
  });

/** True when the straight line between two points passes through a solid: a camera at one would not see the other. */
export const sightBlocked = (solids: Parameters<typeof insideSolid>[0], from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): boolean => {
  const steps = 16;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (insideSolid(solids, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.z + (to.z - from.z) * t, i === 0 ? 0.1 : 0)) return true;
  }
  return false;
};
