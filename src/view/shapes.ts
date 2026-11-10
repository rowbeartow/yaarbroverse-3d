// Small building blocks for the shape heroes: colours, flat-shaded materials
// and boxes. The scenery no longer uses these; it is built in scenery.ts and
// forest.ts. The shape heroes stay until each one's model is in place.

import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Vector3,
  type InstancedMesh,
  type Material,
  type Object3D,
} from 'three';

/** Colours taken from the Caputo Mountain hero art. */
export const COLOR = {
  cream: 0xf6e8c8,
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

type Paint = MeshStandardMaterial | MeshLambertMaterial;

/** Plain matte shading, for machines that draw in software (see Materials). */
let simple = false;
const paintCache = new Map<string, Paint>();

export const useSimplePaint = (on: boolean): void => {
  simple = on;
};

const flat = (options: { color?: number; vertexColors?: boolean }): Paint =>
  simple
    ? new MeshLambertMaterial({ ...options, flatShading: true })
    : new MeshStandardMaterial({ ...options, flatShading: true, roughness: 0.78, metalness: 0 });

/** A flat-shaded, matte material in one colour. Shared between shapes of the same colour. */
export const paint = (color: number): Paint => {
  const key = `${simple}:${color}`;
  let material = paintCache.get(key);
  if (!material) {
    material = flat({ color });
    paintCache.set(key, material);
  }
  return material;
};

/** A material that takes its colours from the shape itself (see fuse). */
export const paintByFace = (): Paint => {
  const key = `${simple}:faces`;
  let material = paintCache.get(key);
  if (!material) {
    material = flat({ vertexColors: true });
    paintCache.set(key, material);
  }
  return material;
};

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
    const material = mesh.material as Paint | undefined;
    const painted = Boolean(material && ('isMeshStandardMaterial' in material || 'isMeshLambertMaterial' in material));
    if (mesh.isMesh && !(mesh as unknown as InstancedMesh).isInstancedMesh && material && painted) {
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
  root.add(new Mesh(geometry, paintByFace()));
};

/** Frees the memory held by every shape under a node. */
export const disposeTree = (root: Object3D): void => {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
};
