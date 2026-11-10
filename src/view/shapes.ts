// Small building blocks for the low-poly look: colours, flat-shaded materials
// and a few shapes Three.js does not have ready-made. Everything in the game is
// built from these in code, so there are no model or picture files to download.

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SRGBColorSpace,
  Vector3,
  type InstancedMesh,
  type Material,
  type Object3D,
} from 'three';

/** Colours taken from the Caputo Mountain storybook forest and hero art. */
export const COLOR = {
  mist: 0x9fcfc4,
  skyTop: 0xfdf0c4,
  skyMid: 0xcfe6cf,
  moss: 0x7fae3c,
  mossDark: 0x5d8c2c,
  mossLight: 0x9cc24a,
  earth: 0x6e4a2c,
  earthDark: 0x4a3524,
  rock: 0x8b8778,
  rockDark: 0x6d6a60,
  rockLight: 0xa09c8c,
  bark: 0x7a5230,
  barkDark: 0x5a3b22,
  wood: 0xd8b27a,
  logTop: 0xa67a4a,
  leafDark: 0x24553c,
  leafMid: 0x2f6b46,
  leafLight: 0x3f8450,
  fern: 0x6fa83a,
  cap: 0xd8572a,
  capDark: 0xb8401c,
  cream: 0xf6e8c8,
  gold: 0xffd34d,
  goldDeep: 0xe0a21a,
  // Yaarbro
  skin: 0xf2b98a,
  beard: 0xe8831e,
  tunic: 0x2a5cb8,
  tunicDark: 0x1f4690,
  cuff: 0xf3e6c8,
  belt: 0x8a4b1e,
  buckle: 0xf2b632,
  trousers: 0x9b6a3a,
  boot: 0x70421f,
  // Caputo
  fur: 0x8f7a63,
  furDark: 0x4d4038,
  furLight: 0xdcc7a4,
  eye: 0x4fc79a,
  nose: 0xc9745f,
  ink: 0x22201c,
} as const;

const lambertCache = new Map<number, MeshLambertMaterial>();

/** A flat-shaded, matte material in one colour. Shared between shapes of the same colour. */
export const paint = (color: number): MeshLambertMaterial => {
  let material = lambertCache.get(color);
  if (!material) {
    material = new MeshLambertMaterial({ color, flatShading: true });
    lambertCache.set(color, material);
  }
  return material;
};

/** A material that takes its colours from the shape itself (see prism). */
export const paintByFace = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** A colour that ignores the lights, for things that glow. */
export const glow = (color: number, opacity = 1): MeshBasicMaterial =>
  new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: false });

/** A box with its middle at (x, y, z). */
export const boxAt = (
  material: Material,
  width: number,
  height: number,
  depth: number,
  x = 0,
  y = 0,
  z = 0,
): Mesh => {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
};

/** An upright post from `bottom` to `top`, wider or narrower at the top if asked. */
export const postAt = (
  material: Material,
  radiusTop: number,
  radiusBottom: number,
  bottom: number,
  top: number,
  x = 0,
  z = 0,
  sides = 8,
): Mesh => {
  const mesh = new Mesh(new CylinderGeometry(radiusTop, radiusBottom, top - bottom, sides, 1), material);
  mesh.position.set(x, (top + bottom) / 2, z);
  return mesh;
};

/**
 * A long shape with the same outline all the way along (a log, a bough).
 * `outline` is the cross-section as [x, y] points, listed anticlockwise when
 * looking at the near end. Faces that point up get the `top` colour.
 */
export const prism = (
  outline: Array<[number, number]>,
  length: number,
  colors: { top: number; side: number; end: number },
): BufferGeometry => {
  const half = length / 2;
  const positions: number[] = [];
  const tints: number[] = [];
  const top = new Color(colors.top);
  const side = new Color(colors.side);
  const end = new Color(colors.end);
  const push = (x: number, y: number, z: number, color: Color): void => {
    positions.push(x, y, z);
    tints.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < outline.length; i += 1) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    const run = Math.hypot(bx - ax, by - ay) || 1;
    const facesUp = -(bx - ax) / run > 0.6;
    const color = facesUp ? top : side;
    push(ax, ay, half, color);
    push(bx, by, -half, color);
    push(bx, by, half, color);
    push(ax, ay, half, color);
    push(ax, ay, -half, color);
    push(bx, by, -half, color);
  }
  for (let i = 1; i < outline.length - 1; i += 1) {
    const [ax, ay] = outline[0];
    const [bx, by] = outline[i];
    const [cx, cy] = outline[i + 1];
    push(ax, ay, half, end);
    push(bx, by, half, end);
    push(cx, cy, half, end);
    push(ax, ay, -half, end);
    push(cx, cy, -half, end);
    push(bx, by, -half, end);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(tints, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/** A soft round glow, drawn once into a tiny picture and reused. */
export const softSpot = (inner: string, outer: string): CanvasTexture => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

/** The sky: pale gold up high, fading to the colour of the mist. */
export const skyTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, `#${new Color(COLOR.skyTop).getHexString()}`);
    gradient.addColorStop(0.45, `#${new Color(COLOR.skyMid).getHexString()}`);
    gradient.addColorStop(0.75, `#${new Color(COLOR.mist).getHexString()}`);
    gradient.addColorStop(1, `#${new Color(COLOR.mist).getHexString()}`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

/** A repeatable random number source, so the forest looks the same every time. */
export const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Melts every plain painted shape under `root` into one shape, so the graphics
 * card draws it in a single go instead of dozens. Anything under a node listed
 * in `leave` is left alone (the parts that move on their own, like a leg).
 */
export const fuse = (root: Object3D, leave: Object3D[] = []): void => {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const positions: number[] = [];
  const tints: number[] = [];
  const used: Mesh[] = [];
  const point = new Vector3();
  const place = new Matrix4();
  const visit = (node: Object3D): void => {
    if (leave.includes(node)) return;
    const mesh = node as Mesh;
    const material = mesh.material as MeshLambertMaterial | undefined;
    if (mesh.isMesh && !(mesh as unknown as InstancedMesh).isInstancedMesh && material?.isMeshLambertMaterial) {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
      const position = geometry.getAttribute('position');
      const color = material.vertexColors ? geometry.getAttribute('color') : null;
      place.multiplyMatrices(toRoot, mesh.matrixWorld);
      for (let i = 0; i < position.count; i += 1) {
        point.fromBufferAttribute(position, i).applyMatrix4(place);
        positions.push(point.x, point.y, point.z);
        if (color) tints.push(color.getX(i), color.getY(i), color.getZ(i));
        else tints.push(material.color.r, material.color.g, material.color.b);
      }
      if (geometry !== mesh.geometry) geometry.dispose();
      used.push(mesh);
    }
    for (const child of [...node.children]) visit(child);
  };
  visit(root);
  if (used.length < 2) return;
  for (const mesh of used) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(tints, 3));
  geometry.computeVertexNormals();
  root.add(new Mesh(geometry, paintByFace));
};

/** Frees the memory held by everything under a node. */
export const disposeTree = (root: Object3D): void => {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
};
