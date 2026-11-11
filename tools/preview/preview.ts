// The script of the hero preview page (see build.mjs). It draws Caputo three
// several times: on a stage, where any clip can be played or the clips are
// mixed by the game's own animation player, and in side views that play the
// walk, the trot and the run slowly over ground that moves at the speed the
// game moves him.

import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  CircleGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  LinearSRGBColorSpace,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  SkeletonHelper,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
  type AnimationAction,
  type Camera,
  type Texture,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MOVE } from '../../src/game/hero';
import { HERO_MODELS, ModelHero } from '../../src/view/hero-model';

const SPEC = HERO_MODELS.Caputo;
const params = new URLSearchParams(window.location.search);
/** Flat light and no shadows, for a machine that draws in software. */
const PLAIN = params.has('plain');
/** Nothing moves until the checks say so. */
const STILL = params.has('still');

interface Loaded {
  model: GLTF;
  sky: DataTexture | null;
  turf: Texture;
  turfNormal: Texture;
}

/** Reads a file that build.mjs wrote as base64 text. */
const bytesOf = async (address: string): Promise<ArrayBuffer> => {
  const reply = await fetch(address);
  if (!reply.ok) throw new Error(`${address}: ${reply.status}`);
  const text = atob((await reply.text()).trim());
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
};

/** The forest light, read the way three's own loader reads it from an address. */
const skyFrom = (bytes: ArrayBuffer): DataTexture => {
  const read = new HDRLoader().parse(bytes);
  const sky = new DataTexture(read.data, read.width, read.height, RGBAFormat, read.type);
  sky.colorSpace = LinearSRGBColorSpace;
  sky.minFilter = sky.magFilter = LinearFilter;
  sky.generateMipmaps = false;
  sky.flipY = true;
  sky.mapping = EquirectangularReflectionMapping;
  sky.needsUpdate = true;
  return sky;
};

const load = async (): Promise<Loaded> => {
  const pictures = new TextureLoader();
  const [bytes, color, surface, turf, turfNormal, sky] = await Promise.all([
    bytesOf('media/caputo.glb.txt'),
    pictures.loadAsync('media/caputo_color.jpg'),
    pictures.loadAsync('media/caputo_mr.png'),
    pictures.loadAsync('media/turf_color.jpg'),
    pictures.loadAsync('media/turf_normal.jpg'),
    PLAIN ? Promise.resolve(null) : bytesOf('media/forest.hdr.txt').then(skyFrom),
  ]);
  const model = await new GLTFLoader().parseAsync(bytes, '');
  color.colorSpace = SRGBColorSpace;
  color.flipY = false;
  surface.flipY = false;
  model.scene.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    material.map = color;
    material.metalnessMap = surface;
    material.roughnessMap = surface;
    material.metalness = 1;
    material.roughness = 1;
    material.needsUpdate = true;
  });
  turf.colorSpace = SRGBColorSpace;
  for (const picture of [turf, turfNormal]) picture.wrapS = picture.wrapT = RepeatWrapping;
  return { model, sky, turf, turfNormal };
};

/** One canvas with its own scene: the game's light, a patch of turf, and a camera. */
class View {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly ground: Mesh;
  readonly turf: Texture;
  /** Metres of turf that one copy of its picture covers. */
  readonly turfSize = 2.2;
  visible = true;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly camera: Camera,
    loaded: Loaded,
    groundSize: number,
  ) {
    const renderer = new WebGLRenderer({ canvas, antialias: !PLAIN, alpha: true });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = !PLAIN;
    renderer.shadowMap.type = PCFShadowMap;
    this.renderer = renderer;

    // The same sun and forest light as the grove (see src/view/grove-view.ts).
    const sun = new DirectionalLight(0xffe6bd, PLAIN ? 2.3 : 3.1);
    sun.position.set(-5, 9, 4);
    sun.castShadow = !PLAIN;
    sun.shadow.mapSize.set(1024, 1024);
    const reach = 3.2;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 30 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 2.5;
    this.scene.add(sun);
    if (loaded.sky) {
      const blur = new PMREMGenerator(renderer);
      this.scene.environment = blur.fromEquirectangular(loaded.sky).texture;
      this.scene.environmentIntensity = 0.85;
      blur.dispose();
    } else this.scene.add(new HemisphereLight(0xfff3d6, 0x5a8a72, 2.1));

    this.turf = loaded.turf.clone();
    const normal = loaded.turfNormal.clone();
    for (const picture of [this.turf, normal]) picture.repeat.set(groundSize / this.turfSize, groundSize / this.turfSize);
    this.ground = new Mesh(
      new CircleGeometry(groundSize / 2, 48),
      new MeshStandardMaterial({ map: this.turf, normalMap: PLAIN ? null : normal, roughness: 0.95, metalness: 0 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    new IntersectionObserver(([entry]) => (this.visible = entry.isIntersecting)).observe(canvas);
  }

  /** Slides the turf back under the hero by `metres`, as if he had gone that far forward. */
  travel(metres: number): void {
    this.turf.offset.y = (this.turf.offset.y + metres / this.turfSize) % 1;
    const normal = (this.ground.material as MeshStandardMaterial).normalMap;
    if (normal) normal.offset.y = this.turf.offset.y;
  }

  /** Matches the drawing to the size the page gives the canvas. Returns width over height. */
  fit(): number {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    const sharpness = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * sharpness) || this.canvas.height !== Math.round(height * sharpness)) {
      this.renderer.setPixelRatio(sharpness);
      this.renderer.setSize(width, height, false);
    }
    return width / Math.max(height, 1);
  }

  draw(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

/** A copy of the model that plays its clips as they are in the file, at the size he is in the game. */
class Puppet {
  readonly root = new Group();
  readonly mixer: AnimationMixer;
  readonly actions = new Map<string, AnimationAction>();
  readonly bones: SkeletonHelper;
  private playing: AnimationAction | null = null;

  constructor(source: GLTF) {
    const model = cloneRigged(source.scene);
    model.traverse((node) => {
      node.castShadow = true;
      node.frustumCulled = false;
    });
    const box = new Box3().setFromObject(model);
    const scale = SPEC.height / (box.max.y - box.min.y);
    model.scale.multiplyScalar(scale);
    model.position.y = -box.min.y * scale;
    this.root.add(model);
    this.mixer = new AnimationMixer(model);
    for (const clip of source.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.bones = new SkeletonHelper(model);
    this.bones.visible = false;
  }

  play(name: string, once = false): void {
    const next = this.actions.get(name);
    if (!next) return;
    this.playing?.stop();
    next.reset().setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = true;
    next.play();
    this.playing = next;
  }

  get length(): number {
    return this.playing?.getClip().duration ?? 1;
  }

  get time(): number {
    return this.playing?.time ?? 0;
  }

  /** Holds the clip at `seconds` into it. */
  hold(seconds: number): void {
    if (!this.playing) return;
    this.playing.time = seconds;
    this.mixer.update(0);
  }

  get finished(): boolean {
    return Boolean(this.playing && !this.playing.isRunning());
  }
}

interface ClipChoice {
  id: string;
  label: string;
  kind: string;
  note: string;
  once?: boolean;
}

const CLIPS: ClipChoice[] = [
  {
    id: 'game',
    label: 'In the game',
    kind: 'Mixed by the game',
    note: 'The clips mixed by the game’s own animation player: he stands, walks, trots, gallops, jumps on the run, lands, drops back to a trot and a walk, stops, and jumps from a standstill. The turf moves at the speed the game moves him.',
  },
  { id: 'idle', label: 'Idle', kind: 'Loops, 8 seconds', note: 'Standing. Slow breathing, his weight easing from side to side, a look to his left and later to his right, an ear flick now and then, and the tip of his tail flicking.' },
  { id: 'walk', label: 'Walk', kind: 'Loops', note: 'One paw at a time: left hind, left front, right hind, right front. Each hind paw lands in the print of the front paw on its side. The shoulder blades rise in turn and the head stays level.' },
  { id: 'trot', label: 'Trot', kind: 'Loops', note: 'Diagonal pairs: left hind with right front, then right hind with left front, in a quick even rhythm. The back stays level, the head is held steady and the tail is up.' },
  { id: 'run', label: 'Run', kind: 'Loops', note: 'A rotary gallop. Each paw lands by itself, going round the body: left hind, right hind, right front, left front. He stretches out in the air after the hind legs push, and his back curls as the legs gather under him.' },
  { id: 'jump', label: 'Jump', kind: 'Plays once', note: 'Shown here slowly, from the crouch. In the game the crouch and push take a tenth of a second, then the rest follows how fast he is rising.', once: true },
  { id: 'falling', label: 'Falling', kind: 'Loops', note: 'Legs reaching down and spread, back a little rounded, tail out behind and working for balance.' },
  { id: 'landing', label: 'Landing', kind: 'Plays once', note: 'Front paws touch first, hind paws follow, the body sinks to take the drop, then he stands.', once: true },
];

/** The big view: any clip, or the clips as the game mixes them. Turns slowly, and can be dragged round. */
class Stage {
  readonly view: View;
  readonly puppet: Puppet;
  readonly hero: ModelHero;
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 60);
  angle = 0.7;
  turning = true;
  slow = false;
  choice: ClipChoice = CLIPS[0];
  /** Seconds a clip that plays once has been finished, before it starts again. */
  private rested = 0;
  // In-the-game mode: a little of the rules, enough to drive the animation player.
  private clock = 0;
  private height = 0;
  private rise = 0;
  private grounded = true;
  private jumped = [false, false];

  constructor(canvas: HTMLCanvasElement, loaded: Loaded) {
    this.view = new View(canvas, this.camera, loaded, 9);
    this.puppet = new Puppet(loaded.model);
    this.hero = new ModelHero(SPEC, loaded.model);
    this.view.scene.add(this.puppet.root, this.puppet.bones, this.hero.root);
    this.choose(CLIPS[0]);
  }

  choose(choice: ClipChoice): void {
    this.choice = choice;
    const game = choice.id === 'game';
    this.hero.root.visible = game;
    this.puppet.root.visible = !game;
    this.rested = 0;
    if (game) {
      this.clock = 0;
      this.height = 0;
      this.rise = 0;
      this.grounded = true;
      this.jumped = [false, false];
    } else this.puppet.play(choice.id, choice.once);
  }

  set skeleton(shown: boolean) {
    this.puppet.bones.visible = shown && this.choice.id !== 'game';
  }

  /** What the player is asking for at each moment of the loop: how fast, and when to jump. */
  private script(): { pace: number; jumpAt: number[] } {
    const t = this.clock;
    const pace = t < 2 ? 0 : t < 4.5 ? 0.25 : t < 7 ? 0.5 : t < 11 ? 1 : t < 12.5 ? 0.5 : t < 14 ? 0.25 : 0;
    return { pace, jumpAt: [9.2, 16] };
  }

  step(dt: number): void {
    if (this.turning) this.angle += dt * 0.25;
    const rate = this.slow ? 0.25 : 1;
    if (this.choice.id === 'game') {
      const step = dt * rate;
      this.clock += step;
      if (this.clock > 18.5) {
        this.clock = 0;
        this.jumped = [false, false];
      }
      const { pace, jumpAt } = this.script();
      jumpAt.forEach((at, i) => {
        if (this.clock >= at && !this.jumped[i] && this.grounded) {
          this.jumped[i] = true;
          this.grounded = false;
          this.rise = MOVE.jumpSpeed;
          this.hero.react('jump');
        }
      });
      if (!this.grounded) {
        this.rise -= MOVE.gravity * step;
        this.height += this.rise * step;
        if (this.height <= 0) {
          this.height = 0;
          this.grounded = true;
          this.hero.animate({ pace, grounded: false, rise: this.rise }, 0);
          this.rise = 0;
          this.hero.react('land');
        }
      }
      this.hero.root.position.y = this.height;
      this.hero.animate({ pace, grounded: this.grounded, rise: this.rise }, step);
      this.view.travel(pace * MOVE.walkSpeed * step);
    } else {
      // A slow jump is easier to read than a fast one.
      const own = this.choice.id === 'jump' ? 0.45 : 1;
      this.puppet.mixer.update(dt * rate * own);
      if (this.puppet.finished) {
        this.rested += dt;
        if (this.rested > 0.9) {
          this.rested = 0;
          this.puppet.play(this.choice.id, true);
        }
      }
    }
  }

  draw(): void {
    const aspect = this.view.fit();
    // Further back on a tall screen, so his whole length stays in view.
    const distance = aspect < 1 ? 8.2 : 5.2;
    this.camera.aspect = aspect;
    this.camera.position.set(Math.sin(this.angle) * distance, 1.9 + this.height * 0.5, Math.cos(this.angle) * distance);
    this.camera.lookAt(0, 0.8 + this.height * 0.75, 0);
    this.camera.updateProjectionMatrix();
    this.view.draw();
  }
}

/** A side view of one clip, played slowly over ground that moves at the speed the game moves him. */
class SideView {
  readonly view: View;
  readonly puppet: Puppet;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  private readonly marks: InstancedMesh;
  private readonly spacing = 0.5;
  private gone = 0;
  rate = 0.25;
  paused = false;

  constructor(
    canvas: HTMLCanvasElement,
    loaded: Loaded,
    readonly clip: string,
    /** Metres a second the game moves him when this clip plays at its own speed. */
    readonly speed: number,
  ) {
    this.view = new View(canvas, this.camera, loaded, 14);
    this.puppet = new Puppet(loaded.model);
    this.puppet.play(clip);
    this.view.scene.add(this.puppet.root, this.puppet.bones);
    // Pale stones set in the turf, so the ground can be seen to move and a
    // planted paw can be seen to stay on its spot.
    this.marks = new InstancedMesh(new PlaneGeometry(0.16, 0.16), new MeshStandardMaterial({ color: new Color(0xfff6dd), roughness: 1 }), 2 * 16);
    this.marks.rotation.x = -Math.PI / 2;
    this.marks.position.y = 0.012;
    this.marks.receiveShadow = true;
    this.view.scene.add(this.marks);
    this.place();
  }

  private place(): void {
    const at = new Matrix4();
    const rows = this.marks.count / 2;
    for (let i = 0; i < this.marks.count; i += 1) {
      const row = Math.floor(i / 2);
      // The marks lie flat, so their "y" runs along the cat: back toward his tail.
      const along = ((row * this.spacing + this.gone) % (rows * this.spacing)) - (rows * this.spacing) / 2;
      at.makeTranslation(i % 2 ? 0.62 : -0.62, along, 0);
      this.marks.setMatrixAt(i, at);
    }
    this.marks.instanceMatrix.needsUpdate = true;
  }

  /** Moves the clip on by `seconds` of its own time, and the ground with it. */
  advance(seconds: number): void {
    this.puppet.mixer.update(seconds);
    this.gone += seconds * this.speed;
    this.view.travel(seconds * this.speed);
    this.place();
  }

  step(dt: number): void {
    if (!this.paused) this.advance(dt * this.rate);
  }

  draw(): void {
    const aspect = this.view.fit();
    // He faces right. The camera sits a little above his back and looks
    // slightly down, so the ground reads as ground.
    const half = Math.max(1.15, 1.85 / aspect);
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.position.set(-12, 2.5, 0.1);
    this.camera.lookAt(0, 0.8, 0.1);
    this.camera.updateProjectionMatrix();
    this.view.draw();
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const toggle = (button: HTMLButtonElement, change: (on: boolean) => void): void => {
  button.addEventListener('click', () => {
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on));
    change(on);
  });
};

const start = async (): Promise<void> => {
  const status = $('status');
  let loaded: Loaded;
  try {
    loaded = await load();
  } catch (error) {
    $('stage').classList.add('failed');
    status.textContent = 'The model did not load. Reload the page to try again.';
    throw error;
  }
  status.hidden = true;

  const stage = new Stage($<HTMLCanvasElement>('view'), loaded);
  const sides = [
    new SideView($<HTMLCanvasElement>('side-walk'), loaded, 'walk', SPEC.walkSpeed),
    new SideView($<HTMLCanvasElement>('side-trot'), loaded, 'trot', SPEC.trotSpeed ?? SPEC.walkSpeed),
    new SideView($<HTMLCanvasElement>('side-run'), loaded, 'run', SPEC.runSpeed),
  ];

  // The clip picker.
  const picker = $('clips');
  const show = (choice: ClipChoice): void => {
    stage.choose(choice);
    stage.skeleton = $('bones').getAttribute('aria-pressed') === 'true';
    for (const button of picker.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.clip === choice.id));
    $('clip-name').textContent = choice.label;
    $('clip-kind').textContent = choice.kind;
    $('clip-note').textContent = choice.note;
  };
  for (const choice of CLIPS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `clip-${choice.id}`;
    button.dataset.clip = choice.id;
    button.textContent = choice.label;
    button.addEventListener('click', () => show(choice));
    picker.append(button);
  }
  show(CLIPS[0]);
  toggle($('turn'), (on) => (stage.turning = on));
  toggle($('slow'), (on) => (stage.slow = on));
  toggle($('bones'), (on) => (stage.skeleton = on));

  // Drag the stage to turn him.
  const canvas = stage.view.canvas;
  let dragFrom: number | null = null;
  canvas.addEventListener('pointerdown', (event) => {
    dragFrom = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragFrom === null) return;
    stage.angle -= (event.clientX - dragFrom) * 0.01;
    dragFrom = event.clientX;
  });
  const drop = (): void => void (dragFrom = null);
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);

  // Each side view: speed, pause, a slider to step through the stride, and the skeleton.
  for (const side of sides) {
    const name = side.clip;
    const speeds = [...document.querySelectorAll<HTMLButtonElement>(`[data-side="${name}"][data-rate]`)];
    for (const button of speeds) {
      button.addEventListener('click', () => {
        side.rate = Number(button.dataset.rate);
        for (const other of speeds) other.setAttribute('aria-pressed', String(other === button));
      });
    }
    const pause = $<HTMLButtonElement>(`pause-${name}`);
    const slider = $<HTMLInputElement>(`scrub-${name}`);
    const setPaused = (paused: boolean): void => {
      side.paused = paused;
      pause.setAttribute('aria-pressed', String(paused));
      pause.textContent = paused ? 'Play' : 'Pause';
    };
    pause.addEventListener('click', () => setPaused(!side.paused));
    slider.addEventListener('input', () => {
      setPaused(true);
      // Step the ground along with the clip, so paws stay on their stones.
      let change = (Number(slider.value) / 1000) * side.puppet.length - side.puppet.time;
      if (change < -side.puppet.length / 2) change += side.puppet.length;
      side.advance(change);
    });
    toggle($(`bones-${name}`), (on) => (side.puppet.bones.visible = on));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
    side.view.canvas.dataset.ready = 'true';
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.turning = false;
    $('turn').setAttribute('aria-pressed', 'false');
  }

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!STILL) {
      if (stage.view.visible) stage.step(dt);
      for (const side of sides) {
        if (!side.view.visible) continue;
        side.step(dt);
        if (!side.paused) $<HTMLInputElement>(`scrub-${side.clip}`).value = String(Math.round((side.puppet.time / side.puppet.length) * 1000));
      }
    }
    if (stage.view.visible) stage.draw();
    for (const side of sides) if (side.view.visible) side.draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // For the checks, and for looking at single moments: pose a view and draw it.
  Object.assign(window, {
    __preview: {
      stage,
      sides,
      /** Holds a side view at a share (0 to 1) of its clip. */
      side(name: string, share: number, bones = false): void {
        const side = sides.find((one) => one.clip === name)!;
        side.paused = true;
        side.puppet.bones.visible = bones;
        side.advance(share * side.puppet.length - side.puppet.time);
        side.draw();
      },
      /** Holds the stage on a clip at a share of it, seen from `angle` radians round. */
      pose(clip: string, share: number, angle: number, bones = false): void {
        stage.turning = false;
        stage.angle = angle;
        stage.choose(CLIPS.find((one) => one.id === clip)!);
        stage.puppet.hold(share * stage.puppet.length);
        stage.skeleton = bones;
        stage.draw();
      },
      /** Runs the in-the-game loop to `seconds`, in steps of a sixtieth, and draws it. */
      game(seconds: number, angle: number): void {
        stage.turning = false;
        stage.angle = angle;
        if (stage.choice.id !== 'game' || seconds < (stage as unknown as { clock: number }).clock) stage.choose(CLIPS[0]);
        while ((stage as unknown as { clock: number }).clock < seconds) stage.step(1 / 60);
        stage.draw();
      },
    },
  });
  document.documentElement.dataset.ready = 'true';
};

void start();
