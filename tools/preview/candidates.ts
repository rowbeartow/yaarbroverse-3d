// The script of the enemy candidates page (see candidates.mjs). Every
// candidate model stands on a patch of turf in the game's light and turns
// slowly. One renderer draws them all, one after another, and each picture is
// copied to that candidate's own canvas, so a page of six needs only one 3D
// drawing surface.

import {
  ACESFilmicToneMapping,
  Box3,
  CircleGeometry,
  DataTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const params = new URLSearchParams(window.location.search);
/** Flat light and no shadows, for a machine that draws in software. */
const PLAIN = params.has('plain');
/** Nothing turns: for still pictures. `?still=1.2` also sets the angle. */
const STILL = params.has('still');

interface CandidateFile {
  letter: string;
  label: string;
  model?: string;
  color?: string | null;
  triangles?: number;
  failed?: string;
}
interface EnemyFile {
  name: string;
  picture: string | null;
  candidates: CandidateFile[];
}

/** What each enemy is called on the page, and whether it stands or hovers. */
const ENEMIES: Record<string, { title: string; hovers: boolean; note: string }> = {
  marmot: {
    title: 'Marmot scout',
    hovers: false,
    note: 'Made from the “Alert” pose of the approved study: on all fours, which is the pose the four-legged rig needs.',
  },
  mosquito: {
    title: 'Giant mosquito',
    hovers: true,
    note: 'Made from the “Hover” pose of the approved study: wings up, legs hanging.',
  },
};

/** Reads a file that candidates.mjs wrote as base64 text. */
const bytesOf = async (address: string): Promise<ArrayBuffer> => {
  const reply = await fetch(address);
  if (!reply.ok) throw new Error(`${address}: ${reply.status}`);
  const text = atob((await reply.text()).trim());
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
};

/** One candidate on the page: its model, its canvas, and how it is turned. */
interface Slot {
  root: Group;
  canvas: HTMLCanvasElement;
  paper: CanvasRenderingContext2D;
  angle: number;
  turning: boolean;
  visible: boolean;
  materials: MeshStandardMaterial[];
  /** How far the camera stands back, and how high it looks. */
  reach: number;
  lookAt: number;
}

const status = document.getElementById('status') as HTMLElement;
const groups = document.getElementById('groups') as HTMLElement;

const start = async (): Promise<void> => {
  const list = (await (await fetch('media/candidates.json')).json()) as EnemyFile[];
  const pictures = new TextureLoader();
  const [turf, turfNormal, skyBytes] = await Promise.all([
    pictures.loadAsync('media/turf_color.jpg'),
    pictures.loadAsync('media/turf_normal.jpg'),
    PLAIN ? Promise.resolve(null) : bytesOf('media/forest.hdr.txt'),
  ]);

  const renderer = new WebGLRenderer({ antialias: !PLAIN, alpha: true, preserveDrawingBuffer: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = !PLAIN;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);

  // The same sun and forest light as the grove (see src/view/grove-view.ts).
  const sun = new DirectionalLight(0xffe6bd, PLAIN ? 2.3 : 3.1);
  sun.position.set(-5, 9, 4);
  sun.castShadow = !PLAIN;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 2.5;
  scene.add(sun);
  if (skyBytes) {
    const read = new HDRLoader().parse(skyBytes);
    const sky = new DataTexture(read.data, read.width, read.height, RGBAFormat, read.type);
    sky.colorSpace = LinearSRGBColorSpace;
    sky.minFilter = sky.magFilter = LinearFilter;
    sky.generateMipmaps = false;
    sky.flipY = true;
    sky.mapping = EquirectangularReflectionMapping;
    sky.needsUpdate = true;
    const blur = new PMREMGenerator(renderer);
    scene.environment = blur.fromEquirectangular(sky).texture;
    scene.environmentIntensity = 0.85;
    blur.dispose();
  } else scene.add(new HemisphereLight(0xfff3d6, 0x5a8a72, 2.1));

  turf.colorSpace = SRGBColorSpace;
  for (const picture of [turf, turfNormal]) {
    picture.wrapS = picture.wrapT = RepeatWrapping;
    picture.repeat.set(2, 2);
  }
  const ground = new Mesh(
    new CircleGeometry(2.2, 48),
    new MeshStandardMaterial({ map: turf, normalMap: PLAIN ? null : turfNormal, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const slots: Slot[] = [];
  let shapeOnly = false;

  for (const enemy of list) {
    const about = ENEMIES[enemy.name] ?? { title: enemy.name, hovers: false, note: '' };
    const section = document.createElement('section');
    section.innerHTML = `<div class="group-head"><div><h2></h2><p class="note"></p></div></div><div class="cards"></div>`;
    (section.querySelector('h2') as HTMLElement).textContent = about.title;
    (section.querySelector('.note') as HTMLElement).textContent = about.note;
    if (enemy.picture) {
      const figure = document.createElement('figure');
      figure.className = 'reference';
      const image = document.createElement('img');
      image.src = enemy.picture;
      image.alt = `The 2D picture every ${about.title.toLowerCase()} candidate was made from`;
      const caption = document.createElement('figcaption');
      caption.textContent = 'The picture they were made from';
      figure.append(image, caption);
      (section.querySelector('.group-head') as HTMLElement).append(figure);
    }
    const cards = section.querySelector('.cards') as HTMLElement;
    groups.append(section);

    for (const candidate of enemy.candidates) {
      const name = `${about.title} ${candidate.letter.toUpperCase()}`;
      const card = document.createElement('article');
      card.className = 'card';
      const title = document.createElement('h3');
      title.textContent = name;
      const made = document.createElement('p');
      made.className = 'made';
      card.append(title);
      cards.append(card);
      if (candidate.failed || !candidate.model) {
        made.textContent = `Meshy could not make this one: ${candidate.failed ?? 'no model'}`;
        card.append(made);
        continue;
      }
      made.textContent = `${candidate.label}. ${Math.round((candidate.triangles ?? 0) / 1000)} thousand triangles before the game shrinks it.`;
      const frame = document.createElement('div');
      frame.className = 'window';
      const canvas = document.createElement('canvas');
      canvas.id = `view-${enemy.name}-${candidate.letter}`;
      canvas.setAttribute('aria-label', `${name}, turning slowly on a patch of turf`);
      frame.append(canvas);
      card.prepend(frame);
      card.append(made);

      const [bytes, color] = await Promise.all([
        bytesOf(candidate.model),
        candidate.color ? pictures.loadAsync(candidate.color) : Promise.resolve(null),
      ]);
      const model = await new GLTFLoader().parseAsync(bytes, '');
      if (color) {
        color.colorSpace = SRGBColorSpace;
        color.flipY = false;
      }
      const materials: MeshStandardMaterial[] = [];
      model.scene.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        const material = mesh.material as MeshStandardMaterial;
        material.map = color;
        material.metalness = 0;
        material.roughness = 0.85;
        material.userData.color = color;
        material.needsUpdate = true;
        materials.push(material);
      });

      // Every candidate is drawn the same size: its longest side is 1.6 m.
      const box = new Box3().setFromObject(model.scene);
      const size = box.getSize(new Vector3());
      const middle = box.getCenter(new Vector3());
      const scale = 1.6 / Math.max(size.x, size.y, size.z);
      const lift = about.hovers ? 0.45 : 0;
      model.scene.scale.multiplyScalar(scale);
      model.scene.position.set(-middle.x * scale, -box.min.y * scale + lift, -middle.z * scale);
      const root = new Group();
      root.add(model.scene);
      root.visible = false;
      scene.add(root);

      const slot: Slot = {
        root,
        canvas,
        paper: canvas.getContext('2d') as CanvasRenderingContext2D,
        angle: STILL ? Number(params.get('still')) || 0.7 : 0.7,
        turning: !STILL,
        visible: true,
        materials,
        reach: 3.5,
        lookAt: (size.y * scale) / 2 + lift,
      };
      slots.push(slot);
      new IntersectionObserver(([entry]) => (slot.visible = entry.isIntersecting)).observe(canvas);

      // Drag to turn it by hand. It starts turning again a moment after letting go.
      let dragFrom: number | null = null;
      let resume = 0;
      canvas.addEventListener('pointerdown', (event) => {
        dragFrom = event.clientX;
        slot.turning = false;
        window.clearTimeout(resume);
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (dragFrom === null) return;
        slot.angle += (event.clientX - dragFrom) * 0.012;
        dragFrom = event.clientX;
      });
      const release = (): void => {
        if (dragFrom === null) return;
        dragFrom = null;
        if (!STILL && turnButton.getAttribute('aria-pressed') === 'true') resume = window.setTimeout(() => (slot.turning = true), 1500);
      };
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      status.textContent = `Loaded ${slots.length} of ${list.reduce((sum, each) => sum + each.candidates.filter((c) => c.model).length, 0)}…`;
    }
  }

  const turnButton = document.getElementById('turn') as HTMLButtonElement;
  turnButton.addEventListener('click', () => {
    const on = turnButton.getAttribute('aria-pressed') !== 'true';
    turnButton.setAttribute('aria-pressed', String(on));
    for (const slot of slots) slot.turning = on && !STILL;
  });
  const shapeButton = document.getElementById('shape') as HTMLButtonElement;
  shapeButton.addEventListener('click', () => {
    shapeOnly = !shapeOnly;
    shapeButton.setAttribute('aria-pressed', String(shapeOnly));
    for (const slot of slots) {
      for (const material of slot.materials) {
        material.map = shapeOnly ? null : material.userData.color;
        material.color.set(shapeOnly ? 0xb9ae98 : 0xffffff);
        material.needsUpdate = true;
      }
    }
  });
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (calm.matches) turnButton.click();

  status.hidden = true;
  document.documentElement.dataset.ready = 'true';

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const slot of slots) {
      if (slot.turning) slot.angle += dt * 0.35;
      if (!slot.visible) continue;
      const { clientWidth: width, clientHeight: height } = slot.canvas;
      if (width === 0 || height === 0) continue;
      const sharpness = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(width * sharpness);
      const h = Math.round(height * sharpness);
      if (slot.canvas.width !== w || slot.canvas.height !== h) {
        slot.canvas.width = w;
        slot.canvas.height = h;
      }
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // The camera goes round the model, so the sun and the shadow stay put.
      camera.position.set(Math.sin(slot.angle) * slot.reach, slot.lookAt + 0.9, Math.cos(slot.angle) * slot.reach);
      camera.lookAt(0, slot.lookAt, 0);
      slot.root.visible = true;
      renderer.render(scene, camera);
      slot.root.visible = false;
      slot.paper.clearRect(0, 0, w, h);
      slot.paper.drawImage(renderer.domElement, 0, 0);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

start().catch((error: unknown) => {
  status.hidden = false;
  status.textContent = `The models did not load. Reload the page to try again. (${error instanceof Error ? error.message : String(error)})`;
});
