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
  CylinderGeometry,
  Quaternion,
  SphereGeometry,
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

/** The catches he can be shown landing: a kind of fish and its length, as the fish book has it. */
const CATCHES = [
  { kind: 'bass', cm: 38, label: 'Bass, 38 cm' },
  { kind: 'perch', cm: 20, label: 'Perch, 20 cm' },
  { kind: 'trout', cm: 50, label: 'Trout, 50 cm' },
  { kind: 'pike', cm: 80, label: 'Pike, 80 cm' },
  { kind: 'pike', cm: 110, label: 'Pike, 110 cm' },
];
/** A landed fish is drawn this many times its real length, so an ordinary bass is about as long as his arm. */
const HELD_TIMES_LIFE = 2;
/** The moments of the "Landed" clip, as shares of it: the fish is in at his feet, he puts the rod down, he has it in both hands, it is lifted clear. */
const LANDED = { fishIn: 0.14, rodDown: 0.2, taken: 0.38, lifted: 0.46 };
/** `?high`: every picture is seen as the game's camera sees a hero, from behind and above. */
const HIGH = params.has('high');

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
  /** Seen as the game's camera sees a hero: from behind and above. */
  high: boolean;
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
  // What a character holds: `held-bass=<the rigged bass>` (or perch, trout, pike) on the command line.
  const heldFish = new Map<string, Awaited<ReturnType<typeof open>>>();
  for (const enemy of list) if (enemy.held) heldFish.set(enemy.name.replace('held-', ''), await open(enemy));

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
        <button type="button" class="high" aria-pressed="false">The game’s camera</button>
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
      reach: params.has('reach') ? REACH : (about.reach ?? REACH),
      high: HIGH,
      angle: 0.9,
      turning: !STILL,
      slow: false,
      visible: true,
      lookAt: (size.y * scale) / 2 + lift,
    };
    slots.set(enemy.name, slot);

    // What he holds while fishing: a bent rod with a reel he winds, and the fish he lands.
    if (about.holds) {
      const right = model.scene.getObjectByName('RightHand');
      const left = model.scene.getObjectByName('LeftHand');
      const leftFore = model.scene.getObjectByName('LeftForeArm');
      // A place given in metres on his model (x to his left, y behind him, z up), on this page.
      const place = (x: number, y: number, z: number): Vector3 =>
        new Vector3(x * scale + model.scene.position.x, z * scale + model.scene.position.y, -y * scale + model.scene.position.z);
      const wood = new MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 });
      const metal = new MeshStandardMaterial({ color: 0xd9a441, roughness: 0.45, metalness: 0.2 });
      const dark = new MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5 });
      const rod = new Mesh(new BufferGeometry(), wood);
      rod.castShadow = true;
      // The reel: a drum on the rod, a crank arm from its axle and a knob in his left hand.
      const drum = new Mesh(new CylinderGeometry(0.1, 0.1, 0.05, 20), metal);
      const arm = new Mesh(new CylinderGeometry(0.016, 0.016, 1, 6), dark);
      const knob = new Mesh(new SphereGeometry(0.04, 12, 8), dark);
      const line = new Mesh(new BufferGeometry(), new MeshStandardMaterial({ color: 0xf8f6ee, emissive: 0x777777 }));
      root.add(rod, drum, arm, knob, line);

      // The fish: one of each kind, drawn at the size of the catch that is picked.
      const fishes = new Map<string, { group: Group; long: number; high: number; mixer: AnimationMixer; clips: Map<string, AnimationAction>; playing: string }>();
      for (const [kind, loaded] of heldFish) {
        const box = new Box3().setFromObject(loaded.scene);
        const size = box.getSize(new Vector3());
        const centre = box.getCenter(new Vector3());
        loaded.scene.position.set(-centre.x, -centre.y, -centre.z);
        const group = new Group();
        group.add(loaded.scene);
        group.visible = false;
        root.add(group);
        const mixer = new AnimationMixer(loaded.scene);
        fishes.set(kind, { group, long: size.z, high: size.y, mixer, clips: new Map(loaded.animations.map((clip) => [clip.name, mixer.clipAction(clip)])), playing: '' });
      }
      let caught = CATCHES.find((entry) => fishes.has(entry.kind)) ?? CATCHES[0];
      const sizes = document.createElement('div');
      sizes.className = 'row small';
      sizes.setAttribute('role', 'group');
      sizes.setAttribute('aria-label', 'The fish he lands');
      for (const entry of CATCHES.filter((each) => fishes.has(each.kind))) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = entry.label;
        button.setAttribute('aria-pressed', String(entry === caught));
        button.addEventListener('click', () => {
          caught = entry;
          for (const other of sizes.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
        });
        sizes.append(button);
      }
      section.querySelector('.now')?.after(sizes);

      // The rod runs from his right hand at his hip up across his body to his left, so the reel's crank turns where the game's camera, behind him, can see it.
      const ALONG = new Vector3(0.757, 0.551, 0.353).normalize();
      const AXLE = new Vector3(0.423, 0, -0.906);
      const WATER = place(0, -4.6, 0.02);
      const BOARDS = place(0, -0.9, 0.12);
      const a = new Vector3();
      const b = new Vector3();
      const c = new Vector3();
      let last = 0;
      const rodFrom = (butt: Vector3, pulled: number): Vector3 => {
        const reach = 2.3 * scale;
        const straight = butt.clone().addScaledVector(ALONG, reach * 0.8);
        const tip = butt.clone().addScaledVector(ALONG, reach * (1 - 0.14 * pulled)).add(new Vector3(-0.1 * pulled, -0.3 * pulled, 0.34 * pulled));
        rod.geometry.dispose();
        rod.geometry = new TubeGeometry(new QuadraticBezierCurve3(butt, straight, tip), 24, 0.02, 6);
        drum.position.copy(butt).addScaledVector(ALONG, 1.52 * scale).addScaledVector(AXLE, 0.03);
        drum.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), AXLE);
        return tip;
      };
      const armTo = (to: Vector3): void => {
        const from = drum.position.clone().addScaledVector(AXLE, 0.06);
        const span = to.clone().sub(from);
        arm.position.copy(from).addScaledVector(span, 0.5);
        arm.scale.set(1, span.length(), 1);
        arm.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), span.clone().normalize());
        knob.position.copy(to);
      };
      const lineTo = (from: Vector3, to: Vector3, sag: number): void => {
        const middle = from.clone().lerp(to, 0.5);
        middle.y -= sag;
        line.geometry.dispose();
        line.geometry = new TubeGeometry(new QuadraticBezierCurve3(from, middle, to), 8, 0.005, 5);
      };
      slot.hold = (): void => {
        const playing = slot.playing;
        const what = playing ? about.holds?.[playing.getClip().name] : undefined;
        for (const part of [rod, drum, arm, knob, line]) part.visible = Boolean(what);
        for (const fish of fishes.values()) fish.group.visible = false;
        if (!right || !left || !leftFore || !what || !playing) return;
        const share = playing.time / playing.getClip().duration;
        const dt = Math.min(Math.abs(playing.time - last), 0.1);
        last = playing.time;
        root.updateMatrixWorld(true);
        right.getWorldPosition(a);
        left.getWorldPosition(b);
        leftFore.getWorldPosition(c);
        // His palm is a little beyond his wrist.
        const palm = b.clone().add(b.clone().sub(c).normalize().multiplyScalar(0.13 * scale));
        const inHand = what === 'rod' || share < LANDED.rodDown;
        if (inHand) {
          const tip = rodFrom(a.clone().addScaledVector(ALONG, -0.16 * scale), 1);
          armTo(what === 'rod' ? palm : drum.position.clone().addScaledVector(AXLE, 0.06).add(new Vector3(0, -0.18 * scale, 0)));
          if (what === 'rod') lineTo(tip, WATER, 0);
        } else {
          // Laid down on the boards beside him.
          rod.geometry.dispose();
          const butt = place(-0.95, 0.5, 0.05);
          const tip = place(-0.75, -1.9, 0.05);
          rod.geometry = new TubeGeometry(new QuadraticBezierCurve3(butt, butt.clone().lerp(tip, 0.5), tip), 4, 0.014, 6);
          drum.position.copy(butt.clone().lerp(tip, 0.3)).add(new Vector3(0, 0.03, 0));
          drum.quaternion.identity();
          arm.visible = knob.visible = false;
        }
        if (what !== 'fish') return;
        const fish = fishes.get(caught.kind);
        if (!fish) {
          line.visible = false;
          return;
        }
        // As long beside him as the catch is: twice life size in the game, where he stands 2.2 m tall.
        const size = ((caught.cm / 100) * HELD_TIMES_LIFE * (2.87 / 2.2) * scale) / fish.long;
        fish.group.scale.setScalar(size);
        fish.group.visible = true;
        const held = a.clone().add(b).multiplyScalar(0.5);
        const across = b.clone().sub(a).normalize();
        const side = new Vector3().crossVectors(new Vector3(0, 1, 0), across).normalize();
        const upright = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, new Vector3().crossVectors(across, side), across));
        // Flat on its side on the boards, nose to his left.
        const flat = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, 0, -1), new Vector3(0, 1, 0), new Vector3(1, 0, 0)));
        // The same, for the clip in which it swims upright.
        const onSide = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, -1, 0), new Vector3(0, 0, -1), new Vector3(1, 0, 0)));
        const lying = BOARDS.clone();
        lying.y = model.scene.position.y + 0.04 + (fish.high * size) * 0.12;
        let clip = 'idle';
        if (share < LANDED.fishIn) {
          // Out of the water on the end of the line, swung in to his feet.
          const t = share / LANDED.fishIn;
          const eased = t * t * (3 - 2 * t);
          fish.group.position.copy(WATER).lerp(lying, eased);
          fish.group.position.y += Math.sin(Math.PI * eased) * 0.75;
          fish.group.quaternion.copy(new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(0, 1, 0)))).slerp(flat, eased * eased);
          const tip = rodFrom(a.clone().addScaledVector(ALONG, -0.16 * scale), 1 - 0.6 * eased);
          const mouth = fish.group.position.clone().add(new Vector3(0, 0, 1).applyQuaternion(fish.group.quaternion).multiplyScalar(fish.long * size * 0.5));
          lineTo(tip, mouth, 0.05);
          clip = 'thrash';
        } else {
          line.visible = false;
          const t = Math.max(0, Math.min(1, (share - LANDED.taken) / (LANDED.lifted - LANDED.taken)));
          const eased = t * t * (3 - 2 * t);
          fish.group.position.copy(lying).lerp(held, eased);
          fish.group.quaternion.copy(t <= 0 ? flat : onSide).slerp(upright, eased);
          clip = t <= 0 ? 'flop' : 'idle';
        }
        if (fish.playing !== clip) {
          fish.clips.get(fish.playing)?.stop();
          fish.clips.get(clip)?.reset().play();
          fish.playing = clip;
        }
        fish.mixer.update(dt);
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
    toggle('.high', (on) => (slot.high = on));
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
    // The game's camera is 12 m behind a hero and 8 m above.
    const angle = slot.high ? Math.PI : slot.angle;
    camera.position.set(Math.sin(angle) * reach, slot.lookAt + (slot.high ? reach * 0.62 : 0.7), Math.cos(angle) * reach);
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
