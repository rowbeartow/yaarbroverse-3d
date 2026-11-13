// The script of the arena preview page (see arena.mjs). It plays the game's
// own rules (src/game), with the level's own numbers, and draws the enemies
// and the hero with the game's own code (src/view/enemies.ts, hero-model.ts).
// Only the scenery is a stand-in: every solid of the level is a plain block.
//
// Two ways to look. "Watch" plays a short script on a loop, with a line
// saying what each part shows. "Play it yourself" hands over the hero, with
// the game's own keys and touch controls.

import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Fog,
  HemisphereLight,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
  type Texture,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from '../../src/game/difficulty';
import { ENEMY, type Enemy } from '../../src/game/enemy';
import { Game, IDLE, type GameEvent, type Input } from '../../src/game/game';
import { HEROES, MOVE, MOVE_NAME, STEP, type HeroName } from '../../src/game/hero';
import { surfaceBelow, type Level, type Solid } from '../../src/game/level';
import { Controls } from '../../src/input/controls';
import { findLevel } from '../../src/levels';
import { ENEMY_MODELS, EnemyView } from '../../src/view/enemies';
import { HERO_MODELS, ModelHero } from '../../src/view/hero-model';

const params = new URLSearchParams(window.location.search);
/** Flat light and no shadows, for a machine that draws in software. */
const PLAIN = params.has('plain');

/** One step of a script: where the hero is put or sent, for how long, and what the page says meanwhile. */
interface Beat {
  seconds: number;
  /** What this part shows, in a line. */
  says: string;
  /** Put the hero here at the start of the beat (a cut). */
  put?: { x: number; z: number; y: number };
  /** Walk between these spots in turn while the beat lasts. Left out: stand still. */
  walk?: Array<{ x: number; z: number }>;
  /** How hard the stick is pushed, 0 to 1. Left out: all the way. */
  push?: number;
}

/** A place on the page: part of a level, the enemy to watch there, and the script that shows it off. */
interface Place {
  id: string;
  label: string;
  level: string;
  /** The enemy the read-out under the picture follows. */
  watch: string;
  /** Where "Play it yourself" stands the hero. */
  start(level: Level): { x: number; y: number; z: number };
  script(level: Level, difficulty: Difficulty): Beat[];
}

const solid = (level: Level, id: string): Solid => level.solids.find((each) => each.id === id) as Solid;
/** The solid the route crosses just before this one. */
const before = (level: Level, id: string): Solid => solid(level, level.route[level.route.indexOf(id) - 1]);
const on = (s: Solid, dx = 0, dz = 0): { x: number; y: number; z: number } => ({ x: s.x + dx, y: s.top, z: s.z + dz });

const scoutPlace = (id: string, label: string, bankId: string, enemyId: string): Place => ({
  id,
  label,
  level: 'bouncing-grove',
  watch: enemyId,
  start: (level) => on(solid(level, bankId), 0, solid(level, bankId).halfZ - 1),
  script: (level, difficulty) => {
    const bank = solid(level, bankId);
    const off = before(level, bankId);
    // Well in from the edge, so a hit does not also throw the hero off the bank.
    const near = on(bank, 0, Math.max(bank.halfZ - 3, 0));
    const rx = bank.halfX - 1.4;
    const rz = bank.halfZ - 1.4;
    const lap = [
      { x: bank.x + rx, z: bank.z + rz },
      { x: bank.x + rx, z: bank.z - rz },
      { x: bank.x - rx, z: bank.z - rz },
      { x: bank.x - rx, z: bank.z + rz },
    ];
    const easy = difficulty === 'easy';
    return [
      { seconds: 9, put: on(off), says: easy ? 'Nobody on its bank: on Easy the scout stays hidden, as before.' : 'Nobody on its bank: the scout walks its beat, in plain view.' },
      { seconds: 7, put: near, says: easy ? 'A hero steps onto the bank and stands still. It pops up, warns, and throws.' : 'A hero steps onto the bank and stands still. It spots the hero, comes after it, and stops to throw.' },
      { seconds: 12, walk: lap, says: easy ? 'The hero keeps moving. It shuffles to keep its distance and throws at where the hero was.' : 'The hero keeps running round the bank. It follows, slower than a hero, and throws when it gets the range.' },
      { seconds: 6, walk: [near], push: 0, says: easy ? 'Standing still again.' : 'Standing still again, close by: it runs straight in. Touching it costs a heart.' },
      { seconds: 7, put: on(off), says: easy ? 'The hero leaves. It goes home and hides.' : 'The hero leaves its bank. It gives up and goes back to its beat.' },
    ];
  },
});

const PLACES: Place[] = [
  scoutPlace('clearing', 'The scout in the clearing', 'bank-2', 'scout-clearing'),
  {
    id: 'boughs',
    label: 'The mosquito over the boughs',
    level: 'bouncing-grove',
    watch: 'mosquito-boughs',
    start: (level) => on(solid(level, 'bough-3'), 0, solid(level, 'bough-3').halfZ - 1),
    script: (level, difficulty) => {
      const bough = solid(level, 'bough-3');
      const ends = [
        { x: bough.x, z: bough.z - bough.halfZ + 0.8 },
        { x: bough.x, z: bough.z + bough.halfZ - 0.8 },
      ];
      const easy = difficulty === 'easy';
      return [
        { seconds: 7, put: on(bough), says: 'A hero stands still on the bough. It hovers overhead, warns, and dives to where the hero stands.' },
        { seconds: 14, walk: ends, push: 0.75, says: easy ? 'The hero walks up and down the bough. On Easy it trails behind, as before.' : 'The hero walks up and down the bough. It keeps up overhead and dives again and again.' },
        { seconds: 5, put: on(solid(level, 'bank-4')), says: 'The hero steps back off the boughs. It goes home.' },
      ];
    },
  },
  scoutPlace('climb', 'The scout at the foot of the climb', 'bank-5', 'scout-climb'),
];

/** What an enemy is doing, in the page's words. */
const DOING: Record<string, string> = {
  concealed: 'Hidden',
  patrol: 'On its beat',
  idle: 'Has seen the hero',
  'dodge-warning': 'About to hop away',
  dodge: 'Hopping away',
  warning: 'Warning',
  attack: 'Attacking',
  rest: 'Resting: the opening',
  defeated: 'Beaten',
};

/** Reads a file that arena.mjs wrote as base64 text. */
const bytesOf = async (address: string): Promise<ArrayBuffer> => {
  const reply = await fetch(address);
  if (!reply.ok) throw new Error(`${address}: ${reply.status}`);
  const text = atob((await reply.text()).trim());
  loading(address);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
};

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const status = byId('status');
/** Anything that goes wrong is put on the page itself, so whoever is looking can say what it was. */
const report = (what: string): void => {
  status.hidden = false;
  status.textContent = `Something went wrong: ${what}. Please send this line back.`;
};
window.addEventListener('error', (event) => report(event.message || 'a script error'));
window.addEventListener('unhandledrejection', (event) => report(event.reason instanceof Error ? event.reason.message : String(event.reason)));
/** Says which file is being fetched, so a page that stops says where. */
let fetched = 0;
const loading = (name: string): void => {
  fetched += 1;
  status.textContent = `Loading: got ${name} (${fetched} of 11 files)…`;
};

const ease = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * (1 - Math.exp(-rate * dt));

const start = async (): Promise<void> => {
  const pictures = new TextureLoader();
  const loadModel = async (name: string): Promise<GLTF> => {
    const [bytes, color] = await Promise.all([bytesOf(`media/${name}.glb.txt`), pictures.loadAsync(`media/${name}_color.jpg`).then((picture) => (loading(`${name}_color.jpg`), picture))]);
    const model = await new GLTFLoader().parseAsync(bytes, '');
    color.colorSpace = SRGBColorSpace;
    color.flipY = false;
    model.scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as MeshStandardMaterial;
      material.map = color;
      material.metalness = 0;
      material.roughness = 0.85;
      material.needsUpdate = true;
    });
    return model;
  };
  const [turf, turfNormal, skyBytes, marmot, mosquito, yaarbro, caputo] = await Promise.all([
    pictures.loadAsync('media/turf_color.jpg').then((picture) => (loading('turf_color.jpg'), picture)),
    pictures.loadAsync('media/turf_normal.jpg').then((picture) => (loading('turf_normal.jpg'), picture)),
    PLAIN ? Promise.resolve(null) : bytesOf('media/forest.hdr.txt'),
    loadModel('marmot'),
    loadModel('mosquito'),
    loadModel('yaarbro'),
    loadModel('caputo'),
  ]);
  const enemyModels = { marmot, mosquito };
  const heroModels: Record<HeroName, GLTF> = { Yaarbro: yaarbro, Caputo: caputo };

  status.textContent = 'Loaded. Starting the picture…';
  const canvas = byId<HTMLCanvasElement>('view');
  canvas.addEventListener('webglcontextlost', () => report('the browser took the 3D picture away (WebGL context lost)'));
  const renderer = new WebGLRenderer({ canvas, antialias: !PLAIN });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !PLAIN;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const mist = new Color(0x9fc4b4);
  scene.background = mist;
  scene.fog = new Fog(mist, 30, 120);
  // The game's own camera: behind and above the hero, always looking the same way.
  const camera = new PerspectiveCamera(50, 16 / 10, 0.1, 300);

  const sun = new DirectionalLight(0xffe6bd, PLAIN ? 2.3 : 3.1);
  sun.castShadow = !PLAIN;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
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
  const tiled = (picture: Texture, across: number, along: number): Texture => {
    const copy = picture.clone();
    copy.wrapS = copy.wrapT = RepeatWrapping;
    copy.repeat.set(across / 4, along / 4);
    copy.needsUpdate = true;
    return copy;
  };
  const wood = new MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.95 });
  const stone = new MeshStandardMaterial({ color: 0x6f7a6c, roughness: 1 });
  const cap = new MeshStandardMaterial({ color: 0xc8483a, roughness: 0.5 });
  const stem = new MeshStandardMaterial({ color: 0xeadfc8, roughness: 0.9 });

  /** Every solid of the level as a plain block: turf on banks, wood on the rest, red caps on mushrooms. */
  const blockOut = (level: Level): Mesh[] => {
    const made: Mesh[] = [];
    const add = (mesh: Mesh): void => {
      mesh.castShadow = !PLAIN;
      mesh.receiveShadow = !PLAIN;
      scene.add(mesh);
      made.push(mesh);
    };
    for (const s of level.solids) {
      const depth = Math.min(s.top - s.bottom, 14);
      if (s.kind === 'mushroom') {
        const top = new Mesh(new CylinderGeometry(s.halfX, s.halfX * 0.8, 0.5, 28), cap);
        top.position.set(s.x, s.top - 0.25, s.z);
        add(top);
        const stalk = new Mesh(new CylinderGeometry(s.halfX * 0.35, s.halfX * 0.45, depth, 14), stem);
        stalk.position.set(s.x, s.top - 0.5 - depth / 2, s.z);
        add(stalk);
      } else if (s.shape === 'round') {
        const post = new Mesh(new CylinderGeometry(s.halfX, s.halfX * 0.9, depth, 24), wood);
        post.position.set(s.x, s.top - depth / 2, s.z);
        add(post);
      } else if (s.kind === 'bank') {
        const top = new MeshStandardMaterial({ map: tiled(turf, s.halfX * 2, s.halfZ * 2), normalMap: PLAIN ? null : tiled(turfNormal, s.halfX * 2, s.halfZ * 2), roughness: 0.95 });
        const sides = s.safe ? new MeshStandardMaterial({ color: 0x55704e, roughness: 1 }) : stone;
        const block = new Mesh(new BoxGeometry(s.halfX * 2, depth, s.halfZ * 2), [sides, sides, top, sides, sides, sides]);
        block.position.set(s.x, s.top - depth / 2, s.z);
        add(block);
      } else {
        const block = new Mesh(new BoxGeometry(s.halfX * 2, depth, s.halfZ * 2), wood);
        block.position.set(s.x, s.top - depth / 2, s.z);
        add(block);
      }
    }
    return made;
  };

  const shadow = new Mesh(new CircleGeometry(0.5, 24), new MeshBasicMaterial({ color: 0x0c1a14, transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const controls = new Controls(byId('stick-zone'), byId('stick-base'), byId('stick-knob'), byId('jump-zone'), byId('move-button'));

  // What is on the page now.
  let place = PLACES.find((each) => each.id === params.get('place')) ?? PLACES[0];
  let difficulty: Difficulty = (DIFFICULTIES.find((each) => each === params.get('difficulty')) ?? 'normal') as Difficulty;
  let heroName: HeroName = HEROES.find((each) => each === params.get('hero')) ?? 'Yaarbro';
  let playing = params.has('play');
  let level!: Level;
  let game!: Game;
  let blocks: Mesh[] = [];
  let hero: ModelHero | null = null;
  let enemies: EnemyView[] = [];
  let beats: Beat[] = [];
  let beat = 0;
  let beatFor = 0;
  let leg = 0;
  let follow = { x: 0, y: 0, z: 0 };
  let was = { x: 0, y: 0, z: 0 };
  let owed = 0;
  let blink = 0;
  let newsFor = 0;
  let lastPut: { x: number; y: number; z: number } | null = null;

  const caption = byId('caption');
  const news = byId('news');
  const hearts = byId('hearts');
  const doing = byId('doing');
  const tell = byId('tell');
  const say = (text: string): void => {
    news.textContent = text;
    newsFor = 2.5;
  };

  const putHero = (at: { x: number; y: number; z: number }): void => {
    Object.assign(game, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, grounded: true, rolling: false, pouncing: 0 });
    was = { ...at };
  };

  const startBeat = (index: number): void => {
    beat = index % beats.length;
    // Each time round starts afresh: every heart, every enemy as it began.
    if (beat === 0 && index > 0) game = new Game(level, difficulty, heroName);
    beatFor = 0;
    leg = 0;
    const now = beats[beat];
    if (now.put) {
      lastPut = now.put;
      putHero(now.put);
      follow = { ...now.put };
    }
    caption.textContent = now.says;
  };

  const setUp = (): void => {
    for (const mesh of blocks) scene.remove(mesh);
    for (const each of enemies) {
      scene.remove(each.root, ...each.extras);
      each.dispose();
    }
    if (hero) {
      scene.remove(hero.root);
      hero.dispose();
    }
    const entry = findLevel(place.level);
    if (!entry) throw new Error(`No level called ${place.level}`);
    level = entry.build(difficulty);
    game = new Game(level, difficulty, heroName);
    blocks = blockOut(level);
    hero = new ModelHero(HERO_MODELS[heroName], heroModels[heroName], PLAIN);
    scene.add(hero.root);
    enemies = (level.enemies ?? []).map((spot) => {
      const view = new EnemyView(ENEMY_MODELS[spot.kind], enemyModels[spot.kind], PLAIN);
      scene.add(view.root, ...view.extras);
      return view;
    });
    beats = place.script(level, difficulty);
    owed = 0;
    blink = 0;
    news.textContent = '';
    controls.enabled = playing;
    controls.release();
    document.body.dataset.mode = playing ? 'play' : 'watch';
    byId('move-button').textContent = MOVE_NAME[heroName];
    if (playing) {
      const at = place.start(level);
      putHero(at);
      follow = { ...at };
      caption.textContent = `You have the hero. Arrow keys or W A S D to move, Space to jump, X or Shift to ${MOVE_NAME[heroName].toLowerCase()}. On a touch screen: left thumb moves, right thumb jumps.`;
    } else startBeat(0);
    const seconds = ENEMY.warning * (level.enemyTuning?.warning ?? 1);
    tell.textContent = `On ${DIFFICULTY_LABEL[difficulty]} a warning lasts ${seconds.toFixed(2)} seconds.`;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-place]')) button.setAttribute('aria-pressed', String(button.dataset.place === place.id));
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) button.setAttribute('aria-pressed', String(button.dataset.difficulty === difficulty));
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-hero]')) button.setAttribute('aria-pressed', String(button.dataset.hero === heroName));
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) button.setAttribute('aria-pressed', String((button.dataset.mode === 'play') === playing));
  };

  /** The script's hand on the stick. */
  const scripted = (): Input => {
    const now = beats[beat];
    if (!now.walk || now.walk.length === 0 || now.push === 0) return IDLE;
    const to = now.walk[leg % now.walk.length];
    const dx = to.x - game.x;
    const dz = to.z - game.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.5) {
      leg += 1;
      return IDLE;
    }
    const push = now.push ?? 1;
    return { moveX: (dx / distance) * push, moveZ: (dz / distance) * push, jump: false };
  };

  const react = (events: GameEvent[]): void => {
    for (const event of events) {
      if (event.type === 'jump' || event.type === 'land' || event.type === 'bounce') hero?.react(event.type);
      else if (event.type === 'fall') {
        blink = MOVE.returnPause;
        say('Fell: back to the last safe bank.');
      } else if (event.type === 'strike') {
        const index = level.enemies?.findIndex((spot) => spot.id === event.id) ?? -1;
        enemies[index]?.strike();
        const name = event.kind === 'marmot' ? 'Marmot' : 'Mosquito';
        say(event.left > 0 ? `${name} knocked back!` : `${name} sent packing!`);
      } else if (event.type === 'hurt') say(event.left > 0 ? `Oof! ${event.left} of ${level.hearts} hearts left.` : 'Out of hearts. Back to safety!');
      else if (event.type === 'restored') say(`Safe again, with all ${level.hearts} hearts.`);
    }
    if (events.some((event) => event.type === 'fall' || event.type === 'restored')) {
      // In a script, a hero knocked off its footing is put back where this part of the script began.
      if (!playing && lastPut) putHero(lastPut);
      was = { x: game.x, y: game.y, z: game.z };
    }
  };

  const fit = (): void => {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (width === 0 || height === 0) return;
    const sharpness = PLAIN ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * sharpness);
    const h = Math.round(height * sharpness);
    if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const draw = (dt: number): void => {
    if (!hero) return;
    const blend = Math.min(owed / STEP, 1);
    const x = was.x + (game.x - was.x) * blend;
    const y = was.y + (game.y - was.y) * blend;
    const z = was.z + (game.z - was.z) * blend;
    hero.root.position.set(x, y, z);
    let turn = game.facing - hero.root.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    hero.root.rotation.y += turn * (1 - Math.exp(-14 * dt));
    hero.animate(
      { pace: Math.min(Math.hypot(game.vx, game.vz) / MOVE.walkSpeed, 1), grounded: game.grounded, rise: game.vy, rolling: game.rolling, pounce: game.pouncing > 0 ? 1 - game.pouncing / MOVE.pounceTime : null },
      dt,
    );
    blink = Math.max(0, blink - dt);
    const flicker = Math.max(blink, game.protectedFor);
    hero.root.visible = flicker <= 0 || Math.floor(flicker * 12) % 2 === 0;
    const tuning = level.enemyTuning ?? { warning: 1, speed: 1, rest: 1 };
    enemies.forEach((each, i) => each.update(game.enemies[i], tuning, game.z, dt));

    const ground = surfaceBelow(level, x, z, y + level.ledgeHelp, MOVE.footRadius);
    shadow.visible = ground !== null;
    if (ground) shadow.position.set(x, ground.top + 0.03, z);

    follow.x = ease(follow.x, x, 7, dt);
    follow.z = ease(follow.z, z, 7, dt);
    follow.y = ease(follow.y, Math.max(y, -4), game.grounded ? 5 : 2.6, dt);
    camera.position.set(follow.x * 0.85, follow.y + 8, follow.z + 12);
    camera.lookAt(follow.x * 0.92, follow.y + 1, follow.z - 4.5);
    sun.target.position.set(follow.x, follow.y, follow.z - 4);
    sun.position.set(follow.x - 14, follow.y + 26, follow.z + 8);

    // The read-out: hearts, and what the watched enemy is doing.
    hearts.textContent = `${'♥'.repeat(game.hearts)}${'♡'.repeat(level.hearts - game.hearts)}`;
    hearts.setAttribute('aria-label', `${game.hearts} of ${level.hearts} hearts`);
    const watched: Enemy | undefined = game.enemies.find((each) => each.spot.id === place.watch);
    if (watched) {
      const moving = watched.phase === 'idle' && watched.kind === 'marmot' && (level.enemyTuning?.chaseSpeed ?? 0) > 0 && watched.timer >= ENEMY.marmotReady;
      const hovering = watched.phase === 'idle' && watched.kind === 'mosquito';
      doing.textContent = moving ? 'Coming after the hero' : hovering ? 'Hovering over the hero' : (DOING[watched.phase] ?? watched.phase);
      doing.dataset.phase = watched.phase;
    }
    newsFor = Math.max(0, newsFor - dt);
    if (newsFor === 0) news.textContent = '';
    fit();
    renderer.render(scene, camera);
  };

  const advance = (dt: number): void => {
    owed += dt;
    let steps = 0;
    while (owed >= STEP && steps < 6) {
      was = { x: game.x, y: game.y, z: game.z };
      game.step(playing ? controls.read() : scripted());
      react(game.events);
      owed -= STEP;
      steps += 1;
      if (!playing) {
        beatFor += STEP;
        if (beatFor >= beats[beat].seconds) startBeat(beat + 1);
      }
    }
    if (steps === 6) owed = 0;
  };

  // The buttons.
  const row = (id: string, items: Array<[string, string]>, key: string, pick: (value: string) => void): void => {
    const holder = byId(id);
    for (const [value, label] of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset[key] = value;
      button.textContent = label;
      button.addEventListener('click', () => {
        pick(value);
        button.blur();
        setUp();
      });
      holder.append(button);
    }
  };
  row('places', PLACES.map((each) => [each.id, each.label]), 'place', (value) => (place = PLACES.find((each) => each.id === value) ?? place));
  row('difficulties', DIFFICULTIES.map((each) => [each, DIFFICULTY_LABEL[each]]), 'difficulty', (value) => (difficulty = value as Difficulty));
  row('heroes', HEROES.map((each) => [each, each]), 'hero', (value) => (heroName = value as HeroName));
  row('modes', [['watch', 'Watch'], ['play', 'Play it yourself']], 'mode', (value) => (playing = value === 'play'));

  setUp();
  status.hidden = true;
  document.documentElement.dataset.ready = 'true';

  // For tools/preview/arena-stills.mjs and for checking the page: the game itself, and a way to run it by hand.
  (window as unknown as { arena: unknown }).arena = {
    get game() {
      return game;
    },
    get beat() {
      return beat;
    },
    /** Runs the page forward this many seconds in fixed steps and draws once. */
    run(seconds: number): void {
      for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
        advance(STEP);
        draw(STEP);
      }
    },
  };
  if (params.has('still')) {
    draw(0);
    return;
  }

  let last = performance.now();
  let shown = true;
  new IntersectionObserver(([entry]) => (shown = entry.isIntersecting)).observe(canvas);
  const frame = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    try {
      if (shown && !document.hidden) {
        advance(dt);
        draw(dt);
      }
    } catch (error) {
      report(error instanceof Error ? `${error.message} (while drawing)` : String(error));
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

start().catch((error: unknown) => {
  status.hidden = false;
  status.textContent = `The page did not load: ${error instanceof Error ? error.message : String(error)}. Please send this line back, then reload to try again.`;
});
