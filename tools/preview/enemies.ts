// The script of the enemies preview page (see enemies.mjs). Each enemy stands
// on a patch of turf in the game's light and plays the clip that is picked.
// One renderer draws them all, one after another, and each picture is copied
// to that enemy's own canvas, so the page needs only one 3D drawing surface.

import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  CircleGeometry,
  DataTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  LinearFilter,
  LinearSRGBColorSpace,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  SkeletonHelper,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const params = new URLSearchParams(window.location.search);
/** Flat light and no shadows, for a machine that draws in software. */
const PLAIN = params.has('plain');
/** Nothing moves until the still-frame tool says so. */
const STILL = params.has('still');

interface EnemyFile {
  name: string;
  model: string;
  color: string;
  clips: string[];
}

interface ClipNote {
  label: string;
  /** What it is for in the game, and what to look for. */
  note: string;
  once?: boolean;
}

/** What the page says about each enemy and each of its clips. */
const ABOUT: Record<string, { title: string; hovers: boolean; clips: Record<string, ClipNote> }> = {
  marmot: {
    title: 'Marmot scout',
    hovers: false,
    clips: {
      idle: { label: 'On watch', note: 'While a hero is near and it is deciding what to do. Breathing, sniffing, a look to each side, ears and tail twitching.' },
      walk: { label: 'Shuffle', note: 'Closing on a hero who is far off, or backing away from one who is too close. A low shuffle in diagonal pairs.' },
      warning: { label: 'Acorn ready', note: 'The warning before a throw. It rears up with the acorn over its shoulder and holds it there. The game stretches this to the length of the warning, which is longer on Easy.', once: true },
      throw: { label: 'Throw', note: 'The arm whips forward and it drops back onto all fours. The acorn leaves the paw a fifth of the way in. The acorn itself is drawn by the game, not by this clip.', once: true },
      winded: { label: 'Winded', note: 'Resting after a throw or a hop. This is the opening to strike it or get past.' },
      hit: { label: 'Struck', note: 'The first time a move lands on it. It rocks back, then sags.', once: true },
      hop: { label: 'Hop away', note: 'Its dodge when a hero charges it along the ground. The game moves it through the air; the clip only crouches, tucks and lands.', once: true },
      defeated: { label: 'Beaten', note: 'The second time a move lands. It goes over onto its back, paws in the air. The game then fades it out.', once: true },
    },
  },
  mosquito: {
    title: 'Giant mosquito',
    hovers: true,
    clips: {
      hover: { label: 'Hover', note: 'Stalking a hero from above. Wings beating fast, body bobbing, legs hanging loose and swinging.' },
      warning: { label: 'Dive ready', note: 'The warning before a dive. It tips nose-down, draws its legs up and holds its aim. The game stretches this to the length of the warning.', once: true },
      dive: { label: 'Dive', note: 'The dive itself. Nose first, wings swept back, legs streaming behind. The game moves it along the line it aimed.' },
      winded: { label: 'Winded', note: 'Resting after a dive. Slow, heavy wingbeats, head and legs drooping. This is the opening to strike it or get past.' },
      defeated: { label: 'Beaten', note: 'A move has landed. The wings stop, it curls up and tumbles. The game drops it and fades it out.', once: true },
    },
  },
};

/** Reads a file that enemies.mjs wrote as base64 text. */
const bytesOf = async (address: string): Promise<ArrayBuffer> => {
  const reply = await fetch(address);
  if (!reply.ok) throw new Error(`${address}: ${reply.status}`);
  const text = atob((await reply.text()).trim());
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
};

/** One enemy on the page. */
interface Slot {
  name: string;
  root: Group;
  canvas: HTMLCanvasElement;
  paper: CanvasRenderingContext2D;
  mixer: AnimationMixer;
  actions: Map<string, AnimationAction>;
  playing: AnimationAction | null;
  once: boolean;
  /** Seconds a clip that plays once has been finished, before it starts again. */
  rested: number;
  bones: SkeletonHelper;
  angle: number;
  turning: boolean;
  slow: boolean;
  visible: boolean;
  lookAt: number;
}

const status = document.getElementById('status') as HTMLElement;
const groups = document.getElementById('groups') as HTMLElement;

const start = async (): Promise<void> => {
  const list = (await (await fetch('media/enemies.json')).json()) as EnemyFile[];
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
    picture.repeat.set(2.5, 2.5);
  }
  const ground = new Mesh(
    new CircleGeometry(2.8, 48),
    new MeshStandardMaterial({ map: turf, normalMap: PLAIN ? null : turfNormal, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const slots = new Map<string, Slot>();

  for (const enemy of list) {
    const about = ABOUT[enemy.name] ?? { title: enemy.name, hovers: false, clips: {} };
    const section = document.createElement('section');
    section.className = 'enemy';
    section.innerHTML = `
      <h2></h2>
      <div class="window"><canvas></canvas></div>
      <div class="row clips" role="group"></div>
      <div class="now" aria-live="polite"><div class="now-head"><h3></h3><span class="kind"></span></div><p class="clip-note"></p></div>
      <div class="row small" role="group">
        <button type="button" class="turn" aria-pressed="true">Turn slowly</button>
        <button type="button" class="slow" aria-pressed="false">Slow motion</button>
        <button type="button" class="bones" aria-pressed="false">Show skeleton</button>
      </div>`;
    (section.querySelector('h2') as HTMLElement).textContent = about.title;
    const canvas = section.querySelector('canvas') as HTMLCanvasElement;
    canvas.id = `view-${enemy.name}`;
    canvas.setAttribute('aria-label', `The ${about.title.toLowerCase()} on a patch of turf, playing the chosen clip while the view turns slowly`);
    (section.querySelector('.clips') as HTMLElement).setAttribute('aria-label', `${about.title} clip`);
    (section.querySelector('.small') as HTMLElement).setAttribute('aria-label', `${about.title} view`);
    groups.append(section);

    const [bytes, color] = await Promise.all([bytesOf(enemy.model), pictures.loadAsync(enemy.color)]);
    const model = await new GLTFLoader().parseAsync(bytes, '');
    color.colorSpace = SRGBColorSpace;
    color.flipY = false;
    model.scene.traverse((node) => {
      node.frustumCulled = false;
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as MeshStandardMaterial;
      // A see-through part (the mosquito's wings) casts no shadow of its own.
      mesh.castShadow = !material.transparent;
      material.map = color;
      material.metalness = 0;
      material.roughness = 0.85;
      material.needsUpdate = true;
    });

    // Drawn so its longest side is 1.6 m, measured standing at rest.
    const box = new Box3().setFromObject(model.scene);
    const size = box.getSize(new Vector3());
    const middle = box.getCenter(new Vector3());
    const scale = 1.6 / Math.max(size.x, size.y, size.z);
    const lift = about.hovers ? 0.55 : 0;
    model.scene.scale.multiplyScalar(scale);
    model.scene.position.set(-middle.x * scale, -box.min.y * scale + lift, -middle.z * scale);
    const root = new Group();
    root.add(model.scene);
    const bones = new SkeletonHelper(model.scene);
    bones.visible = false;
    root.add(bones);
    root.visible = false;
    scene.add(root);

    const mixer = new AnimationMixer(model.scene);
    const actions = new Map<string, AnimationAction>();
    for (const clip of model.animations) actions.set(clip.name, mixer.clipAction(clip));
    const slot: Slot = {
      name: enemy.name,
      root,
      canvas,
      paper: canvas.getContext('2d') as CanvasRenderingContext2D,
      mixer,
      actions,
      playing: null,
      once: false,
      rested: 0,
      bones,
      angle: 0.9,
      turning: !STILL,
      slow: false,
      visible: true,
      lookAt: (size.y * scale) / 2 + lift,
    };
    slots.set(enemy.name, slot);
    new IntersectionObserver(([entry]) => (slot.visible = entry.isIntersecting)).observe(canvas);

    const heading = section.querySelector('h3') as HTMLElement;
    const kind = section.querySelector('.kind') as HTMLElement;
    const note = section.querySelector('.clip-note') as HTMLElement;
    const row = section.querySelector('.clips') as HTMLElement;
    const choose = (clip: string): void => {
      const next = actions.get(clip);
      if (!next) return;
      const words = about.clips[clip] ?? { label: clip, note: '' };
      slot.playing?.stop();
      slot.once = Boolean(words.once);
      slot.rested = 0;
      next.reset().setLoop(slot.once ? LoopOnce : LoopRepeat, slot.once ? 1 : Infinity);
      next.clampWhenFinished = true;
      next.play();
      slot.playing = next;
      heading.textContent = words.label;
      kind.textContent = `${slot.once ? 'Plays once' : 'Loops'}, ${next.getClip().duration.toFixed(1)} seconds`;
      note.textContent = words.note;
      for (const button of row.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.clip === clip));
    };
    for (const clip of enemy.clips) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.clip = clip;
      button.textContent = about.clips[clip]?.label ?? clip;
      button.addEventListener('click', () => choose(clip));
      row.append(button);
    }
    choose(enemy.clips[0]);

    const toggle = (selector: string, apply: (on: boolean) => void): void => {
      const button = section.querySelector(selector) as HTMLButtonElement;
      button.addEventListener('click', () => {
        const on = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', String(on));
        apply(on);
      });
    };
    toggle('.turn', (on) => (slot.turning = on));
    toggle('.slow', (on) => (slot.slow = on));
    toggle('.bones', (on) => (bones.visible = on));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) (section.querySelector('.turn') as HTMLButtonElement).click();

    // Drag to turn it by hand.
    let dragFrom: number | null = null;
    canvas.addEventListener('pointerdown', (event) => {
      dragFrom = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (dragFrom === null) return;
      slot.angle += (event.clientX - dragFrom) * 0.012;
      dragFrom = event.clientX;
    });
    const release = (): void => void (dragFrom = null);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  const draw = (slot: Slot): void => {
    const { clientWidth: width, clientHeight: height } = slot.canvas;
    if (width === 0 || height === 0) return;
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
    // The camera goes round the enemy, so the sun and the shadow stay put.
    const reach = 3.4;
    camera.position.set(Math.sin(slot.angle) * reach, slot.lookAt + 0.7, Math.cos(slot.angle) * reach);
    camera.lookAt(0, slot.lookAt, 0);
    slot.root.visible = true;
    renderer.render(scene, camera);
    slot.root.visible = false;
    slot.paper.clearRect(0, 0, w, h);
    slot.paper.drawImage(renderer.domElement, 0, 0);
  };

  // For tools/preview/enemy-stills.mjs: hold a clip at a share of its length, seen from an angle.
  (window as unknown as { preview: unknown }).preview = {
    hold(name: string, clip: string, share: number, angle: number, skeleton = false): boolean {
      const slot = slots.get(name);
      const action = slot?.actions.get(clip);
      if (!slot || !action) return false;
      slot.playing?.stop();
      action.reset().play();
      action.paused = true;
      action.time = action.getClip().duration * share;
      slot.playing = action;
      slot.mixer.update(0);
      slot.angle = angle;
      slot.bones.visible = skeleton;
      draw(slot);
      return true;
    },
    clips: (name: string): string[] => [...(slots.get(name)?.actions.keys() ?? [])],
  };

  status.hidden = true;
  document.documentElement.dataset.ready = 'true';
  if (STILL) return;

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const slot of slots.values()) {
      if (slot.turning) slot.angle += dt * 0.3;
      slot.mixer.update(dt * (slot.slow ? 0.25 : 1));
      // A clip that plays once rests on its last pose for a moment, then plays again.
      if (slot.once && slot.playing && !slot.playing.isRunning()) {
        slot.rested += dt;
        if (slot.rested > 1.2) {
          slot.rested = 0;
          slot.playing.reset().play();
        }
      }
      if (slot.visible) draw(slot);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

start().catch((error: unknown) => {
  status.hidden = false;
  status.textContent = `The models did not load. Reload the page to try again. (${error instanceof Error ? error.message : String(error)})`;
});
