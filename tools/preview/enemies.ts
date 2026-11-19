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
  DoubleSide,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  BufferGeometry,
  Matrix4,
  QuadraticBezierCurve3,
  TubeGeometry,
  LinearFilter,
  LinearSRGBColorSpace,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PlaneGeometry,
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
/** No water drawn, to see the whole of a water enemy: `?dry`. */
const DRY = params.has('dry');
/** How far the camera stands off, in metres: `?reach=2.2` for a closer look. */
const REACH = Number(params.get('reach') ?? 3.4);

interface EnemyFile {
  name: string;
  model: string;
  color: string;
  clips: string[];
  /** Not shown on its own: something a character holds in one of its clips (a name that starts with `held-`). */
  held?: boolean;
}

interface ClipNote {
  label: string;
  /** What it is for in the game, and what to look for. */
  note: string;
  once?: boolean;
}

/** What the page says about each enemy and each of its clips. */
/**
 * `water`, for an enemy that lives in it: how high the water stands for each
 * clip, in metres of the model as it came from the rig, so the page shows
 * what a player sees above the surface. The game sets the real depth.
 */
const ABOUT: Record<string, { title: string; hovers: boolean; clips: Record<string, ClipNote>; water?: Record<string, number>; holds?: Record<string, 'rod' | 'fish'>; reach?: number }> = {
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
  crocodile: {
    title: 'Crocodile',
    hovers: false,
    clips: {
      lurk: { label: 'Lurking', note: 'Waiting in the water with only its eyes and the top of its snout above the surface. Almost still: a slow breath, the tail drifting.' },
      swim: { label: 'Surface swim', note: 'Swimming at the surface, back just awash: steady sweeps of the tail, legs folded back along its sides.' },
      dive: { label: 'Underwater swim', note: 'Swimming under the surface after a diving hero: longer, stronger sweeps, nose a little down.' },
      lunge: { label: 'Lunge and bite', note: 'It gathers, throws itself forward with its jaws wide, and snaps them shut a third of a second in. The game moves it forward; the clip only gathers, reaches and settles.', once: true },
      hit: { label: 'Flinch', note: 'When a hero strikes it: the head jerks up and away, the body twists and the tail thrashes.', once: true },
      defeated: { label: 'Beaten', note: 'It rolls slowly onto its side and sinks away. The game then fades it out.', once: true },
    },
    water: { lurk: 0.48, swim: 0.4, dive: 0.95, lunge: 0.4, hit: 0.4, defeated: 0.4 },
  },
};

/** A hero's fishing clips, for looking at before they go on the hero in the game. Its other clips are on the page too, with no notes. */
ABOUT.yaarbro = {
  holds: { fish_reel: 'rod', fish_show: 'fish' },
  // Stood further off, so a fish held over his head is in the picture.
  reach: 4.9,
  title: 'Yaarbro, fishing',
  hovers: false,
  clips: {
    fish_cast: { label: 'Cast', note: 'The rod goes back over his shoulder and whips forward. Made by Meshy from a description: its library has no fishing.', once: true },
    fish_reel: { label: 'Reel', note: 'Braced and leaning back against the fish, the rod bent over and the line tight, his left hand winding the reel round and round. It loops for as long as the button reels. Made in Blender on his own skeleton: Meshy has no fishing.', once: false },
    fish_show: { label: 'Landed', note: 'The fish comes in: he bends to take it in both hands, heaves it up over his head and holds it there to show it off. Made in Blender on his own skeleton.', once: true },
  },
};

/** The fish of Cocolalla Lake share one skeleton and one set of clips (tools/rig-fish.py). */
const FISH_CLIPS: Record<string, ClipNote> = {
  idle: { label: 'Holding still', note: 'Waiting in the water, or looking at a lure. A slow wave down the tail.' },
  swim: { label: 'Swimming', note: 'Going somewhere: the wave runs down the body and grows toward the tail fin. The game moves it; the clip stays on the spot.' },
  thrash: { label: 'Thrashing', note: 'Fighting the line. Three hard beats, the whole fish rolling and its head shaking. This is the tell to let the line run.' },
  flop: { label: 'Landed', note: 'On the dock, on its side: two slaps of the tail, then a rest.' },
};
for (const [name, title] of [['bass', 'Bass'], ['perch', 'Perch'], ['trout', 'Trout'], ['pike', 'Pike']]) ABOUT[name] = { title, hovers: true, clips: FISH_CLIPS };

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
  /** Puts what the character holds in the playing clip (a rod, a fish) in its hands. */
  hold: (() => void) | null;
  /** How far off the camera stands. */
  reach: number;
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

  const open = async (enemy: EnemyFile): Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>> => {
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
    return model;
  };
  // What a character holds: `held-fish=<a rigged fish>` on the command line.
  const heldFish = list.find((enemy) => enemy.name === 'held-fish');
  const fishModel = heldFish ? (await open(heldFish)).scene : null;

  for (const enemy of list) {
    if (enemy.held) continue;
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

    const model = await open(enemy);

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
    // The surface of the water, for an enemy that lives in it.
    const surface = new Mesh(
      new PlaneGeometry(4, 4),
      new MeshStandardMaterial({ color: 0x2f6e6c, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.05, depthWrite: false, side: DoubleSide }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.renderOrder = 2;
    surface.visible = false;
    root.add(surface);
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
      hold: null,
      reach: about.reach ?? REACH,
      angle: 0.9,
      turning: !STILL,
      slow: false,
      visible: true,
      lookAt: (size.y * scale) / 2 + lift,
    };
    slots.set(enemy.name, slot);

    // A rod in his right hand, bent over with the line tight, or a fish across both hands.
    if (about.holds) {
      const right = model.scene.getObjectByName('RightHand');
      const left = model.scene.getObjectByName('LeftHand');
      const wood = new MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 });
      const rod = new Mesh(new BufferGeometry(), wood);
      rod.castShadow = true;
      const reel = new Mesh(new CircleGeometry(0.045, 16), new MeshStandardMaterial({ color: 0x30343a, roughness: 0.5, side: DoubleSide }));
      const line = new Mesh(new BufferGeometry(), new MeshStandardMaterial({ color: 0xf8f6ee, emissive: 0x777777 }));
      line.frustumCulled = false;
      const fish = new Group();
      if (fishModel) {
        const box = new Box3().setFromObject(fishModel);
        const long = box.getSize(new Vector3());
        const centre = box.getCenter(new Vector3());
        // As big beside him as the game draws a good bass: a little over half his height.
        const size = 0.85 / Math.max(long.x, long.y, long.z);
        fishModel.scale.setScalar(size);
        fishModel.position.set(-centre.x * size, -box.min.y * size, -centre.z * size);
        fish.add(fishModel);
      }
      root.add(rod, reel, line, fish);
      const a = new Vector3();
      const b = new Vector3();
      slot.hold = (): void => {
        const what = slot.playing ? about.holds?.[slot.playing.getClip().name] : undefined;
        rod.visible = reel.visible = line.visible = what === 'rod';
        fish.visible = what === 'fish' && Boolean(fishModel) && (slot.playing as AnimationAction).time > 0.2;
        if (!right || !left || !what) return;
        root.updateMatrixWorld(true);
        right.getWorldPosition(a);
        left.getWorldPosition(b);
        if (what === 'rod') {
          // From the butt at his right hand, up and out ahead of him, the tip pulled over by the fish.
          const butt = new Vector3(a.x, a.y - 0.07, a.z - 0.08);
          const straight = new Vector3(a.x * 0.6, a.y + 0.95, a.z + 0.75);
          const tip = new Vector3(a.x * 0.3, a.y + 0.62, a.z + 1.3);
          const bend = new QuadraticBezierCurve3(butt, straight, tip);
          rod.geometry.dispose();
          rod.geometry = new TubeGeometry(bend, 20, 0.014, 6);
          reel.position.copy(bend.getPoint(0.12));
          reel.position.x += 0.03;
          reel.rotation.y = Math.PI / 2;
          line.geometry.dispose();
          line.geometry = new TubeGeometry(new QuadraticBezierCurve3(tip, tip.clone().lerp(new Vector3(0.05, 0.02, tip.z + 1.25), 0.5), new Vector3(0.05, 0.02, tip.z + 1.25)), 2, 0.005, 5);
          return;
        }
        // The fish lies across both hands, nose to his left.
        const along = b.clone().sub(a).normalize();
        const up = new Vector3(0, 1, 0);
        const side = new Vector3().crossVectors(up, along).normalize();
        fish.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(side, new Vector3().crossVectors(along, side), along));
        fish.position.copy(a).add(b).multiplyScalar(0.5);
        fish.position.y += 0.03;
      };
    }
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
      const level = about.water?.[clip];
      surface.visible = level !== undefined && !DRY;
      if (level !== undefined) surface.position.y = level * scale;
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
    const reach = slot.reach;
    camera.position.set(Math.sin(slot.angle) * reach, slot.lookAt + 0.7, Math.cos(slot.angle) * reach);
    camera.lookAt(0, slot.lookAt, 0);
    slot.root.visible = true;
    slot.hold?.();
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
