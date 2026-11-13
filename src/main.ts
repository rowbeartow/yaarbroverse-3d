// Starts the page and runs the game loop: read the controls, advance the rules
// in fixed steps, draw. The rules live in src/game, the levels in src/levels,
// the drawing in src/view. This file only connects them.
//
// Which level is built comes from the level list (src/levels/index.ts): the
// first one players are shown, or the one named on the address (?level=sandbox),
// which is the only way into a development level.
//
// The start screen shows straight away. The 3D code and its files download
// behind it, with a progress bar, and Play switches on when they are ready.
//
// Sound (src/audio) starts on the first tap or key press, because browsers
// block it before that. The Sound button and the M key mute it, and the
// choice is remembered.

import './style.css';
import { GameSounds } from './audio/game-sounds';
import { Sound } from './audio/mix';
import { Player } from './audio/player';
import { Game, IDLE, type GameEvent } from './game/game';
import { MOVE_NAME, STEP } from './game/hero';
import type { Level } from './game/level';
import { Controls } from './input/controls';
import { levelFromAddress, listedLevels } from './levels';
import { Screens, isTouchDevice, loadChoice, needsTurning, saveChoice, type Choice } from './ui/screens';
import type { GroveView } from './view/grove-view';

type Mode = 'start' | 'playing' | 'paused' | 'ended';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const boot = (): void => {
  let view: GroveView | null = null;
  const entry = levelFromAddress(window.location.search) ?? listedLevels()[0];
  let choice: Choice = loadChoice();
  let level: Level = entry.build(choice.difficulty);
  let game = new Game(level, choice.difficulty, choice.hero);
  let mode: Mode = 'start';
  let before = { x: game.x, y: game.y, z: game.z };
  let owed = 0;
  let sinceGoal = 0;
  let turned = false;
  const seen = new Set<string>();
  /** Scouts that have already come out of hiding this run. */
  const met = new Set<string>();
  /** Game time until which a line about hearts or enemies keeps the screen. */
  let newsUntil = 0;

  // Sound. The files are fetched now; nothing plays until the first tap or key press.
  const player = new Player();
  const memory = ((): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const sound = new Sound(player, memory);
  const gameSounds = new GameSounds(sound);
  void player.preload();
  sound.setMusic(entry.music);
  // Any of these counts as the player's say-so. They are caught before anything
  // else sees them, so the very tap that starts the game can also be heard.
  for (const kind of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(kind, () => sound.unlock(), { capture: true, passive: true });
  }
  const muteButton = document.querySelector<HTMLButtonElement>('#mute')!;
  const showMute = (muted: boolean): void => {
    muteButton.textContent = muted ? 'Sound off' : 'Sound on';
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? 'Sound is off. Turn sound on.' : 'Sound is on. Turn sound off.');
  };
  sound.onMute = showMute;
  showMute(sound.muted);
  muteButton.addEventListener('click', () => {
    sound.toggleMute();
    // A key press on the page should not land on this button afterwards.
    muteButton.blur();
  });
  // Every button gives a soft click.
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) sound.play('button');
  });

  const controls = new Controls(
    document.querySelector<HTMLElement>('#stick-zone')!,
    document.querySelector<HTMLElement>('#stick-base')!,
    document.querySelector<HTMLElement>('#stick-knob')!,
    document.querySelector<HTMLElement>('#jump-zone')!,
    document.querySelector<HTMLElement>('#move-button')!,
  );

  /** Builds the level and hero for the current choice and stands the hero at the start. */
  const setUp = (): void => {
    level = entry.build(choice.difficulty);
    game = new Game(level, choice.difficulty, choice.hero);
    before = { x: game.x, y: game.y, z: game.z };
    owed = 0;
    sinceGoal = 0;
    seen.clear();
    met.clear();
    newsUntil = 0;
    gameSounds.reset();
    view?.show(level, choice.hero, entry.scenery);
    view?.snapCamera(game);
  };

  const screens = new Screens(choice, entry, (picked) => {
    const rebuild = picked.difficulty !== choice.difficulty || picked.hero !== choice.hero;
    choice = picked;
    saveChoice(choice);
    if (rebuild) setUp();
  });

  const setMode = (next: Mode): void => {
    mode = next;
    controls.enabled = next === 'playing';
    controls.release();
    // The roll and the mosquito's whine stop with the game.
    if (next !== 'playing') sound.stopLoops();
    if (next === 'start') screens.show('start');
    else if (next === 'paused') screens.show('paused');
    else if (next === 'playing') screens.show('none');
  };

  const play = (): void => {
    if (!view) return;
    setUp();
    screens.setPlace(level.name, choice.difficulty);
    screens.setHearts(game.hearts, level.hearts);
    setMode('playing');
    const moveName = MOVE_NAME[choice.hero];
    screens.setMove(moveName);
    screens.say(
      isTouchDevice()
        ? `Left thumb moves. Right thumb jumps. The ${moveName} button is above Jump.`
        : `Arrow keys or W A S D to move. Space to jump. X or Shift to ${moveName.toLowerCase()}.`,
      6,
    );
  };

  const pause = (): void => {
    if (mode === 'playing') setMode('paused');
  };

  document.querySelector('#play')!.addEventListener('click', play);
  document.querySelector('#again')!.addEventListener('click', () => {
    setUp();
    setMode('start');
  });
  document.querySelector('#pause')!.addEventListener('click', pause);
  document.querySelector('#resume')!.addEventListener('click', () => setMode('playing'));
  document.querySelector('#restart')!.addEventListener('click', play);
  document.querySelector('#quit')!.addEventListener('click', () => {
    setUp();
    setMode('start');
  });
  document.querySelector('#reload')!.addEventListener('click', () => window.location.reload());
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey) sound.toggleMute();
    if (event.code !== 'Escape' && event.code !== 'KeyP') return;
    if (mode === 'playing') pause();
    else if (mode === 'paused') setMode('playing');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  /** Sizes the picture to the window and decides whether to ask for a sideways turn. */
  const fit = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    view?.resize(width, height);
    turned = needsTurning(isTouchDevice(), width, height);
    screens.rotate.hidden = !turned;
    if (turned) controls.release();
  };
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  window.visualViewport?.addEventListener('resize', fit);

  /** What the rules reported this step, turned into messages. */
  const narrate = (events: GameEvent[]): void => {
    let safe = false;
    // News about hearts and enemies matters more than a prompt about the way ahead.
    const news = (text: string, seconds: number): void => {
      screens.say(text, seconds);
      newsUntil = game.seconds + seconds;
    };
    for (const event of events) {
      if (event.type === 'fall') screens.say('Back to safety…', 2);
      else if (event.type === 'hurt' && event.left > 0) news(`Oof! ${event.left} of ${level.hearts} hearts left.`, 2.5);
      else if (event.type === 'hurt') news('Out of hearts. Back to safety!', 2.5);
      else if (event.type === 'restored') news(`Safe again, with all ${level.hearts} hearts.`, 3);
      else if (event.type === 'enemy' && event.phase === 'idle' && event.kind === 'marmot' && !met.has(event.id)) {
        // The first time a scout comes out of hiding.
        met.add(event.id);
        news('A rustle in the roots… Marmot scout!', 2.5);
      } else if (event.type === 'strike') {
        const name = event.kind === 'marmot' ? 'Marmot' : 'Mosquito';
        news(event.left > 0 ? `${name} knocked back!` : `${name} sent packing!`, 2.5);
      } else if (event.type === 'safe') safe = true;
      else if (event.type === 'goal') screens.say(level.goalLine ?? 'You made it!', 4);
    }
    // Each part of the level has one short prompt, shown the first time you
    // stand there. It waits its turn behind any news.
    if (game.seconds < newsUntil) return;
    const hint = game.groundId && !seen.has(game.groundId) ? level.hints?.[game.groundId] : undefined;
    if (hint && game.groundId) seen.add(game.groundId);
    if (safe && hint) screens.say(`Safe on the mossy bank. ${hint}`, 5);
    else if (safe) screens.say('Safe on the mossy bank.', 2.5);
    else if (hint) screens.say(hint, 4);
  };

  // The frame counter, shown when the address ends in ?fps.
  const showRate = new URLSearchParams(window.location.search).has('fps');
  let sinceRate = 0;

  let last = performance.now();
  const loop = (now: number): void => {
    if (!view) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const running = (mode === 'playing' || mode === 'ended') && !turned;
    if (running) {
      owed += dt;
      let steps = 0;
      while (owed >= STEP && steps < 6) {
        before = { x: game.x, y: game.y, z: game.z };
        game.step(mode === 'playing' ? controls.read() : IDLE);
        // After a fall, or after running out of hearts, the hero is somewhere else entirely: do not slide there.
        if (game.events.some((event) => event.type === 'fall' || event.type === 'restored')) before = { x: game.x, y: game.y, z: game.z };
        view.handle(game.events);
        narrate(game.events);
        gameSounds.step(game);
        owed -= STEP;
        steps += 1;
      }
      if (steps === 6) owed = 0;
      screens.setHearts(game.hearts, level.hearts);
      if (game.complete && mode === 'playing') {
        mode = 'ended';
        sound.stopLoops();
        controls.enabled = false;
        controls.release();
        sinceGoal = 0;
      }
      if (mode === 'ended' && screens.end.hidden) {
        sinceGoal += dt;
        if (sinceGoal > 1.6) {
          screens.hush();
          screens.showEnd(game.summary(), new Date());
        }
      }
    }
    view.frame(game, before, running ? Math.min(owed / STEP, 1) : 1, running ? dt : 0);
    if (showRate) {
      sinceRate += dt;
      if (sinceRate > 0.5) {
        sinceRate = 0;
        screens.showRate(view.stats());
      }
    }
    requestAnimationFrame(loop);
  };

  // A small window into the running game for the browser checks in tests/browser.
  Object.defineProperty(window, '__grove', {
    value: {
      get game() {
        return game;
      },
      get mode() {
        return mode;
      },
      /** The id of the level that is up, from the level list. */
      get level() {
        return entry.id;
      },
      /** True once the 3D picture has loaded and Play works. */
      get ready() {
        return view !== null;
      },
      get stats() {
        return view ? view.stats() : null;
      },
      get hero() {
        return view ? view.heroInfo() : null;
      },
      get enemies() {
        return view ? view.enemyInfo() : [];
      },
      /** What the sound is doing: whether it has been unlocked, muted, and what has played. */
      get sound() {
        return { unlocked: sound.unlocked, muted: sound.muted, ...player.info() };
      },
      /** The picture itself, for looking into when something draws wrong or slowly. */
      get view() {
        return view;
      },
    },
  });

  fit();
  setMode('start');
  screens.setLoading(0);

  // The 3D code is the big part of the download, so it is fetched after the
  // start screen is up. It counts as the first tenth of the progress bar.
  void (async () => {
    try {
      const { GroveView } = await import('./view/grove-view');
      screens.setLoading(0.1);
      view = await GroveView.create(canvas, (share) => screens.setLoading(0.1 + share * 0.9));
    } catch (error) {
      console.error(error);
      // Either this browser cannot draw 3D at all, or a file did not arrive.
      screens.fail(error instanceof Error && error.name === 'No3d' ? 'no-3d' : 'download');
      return;
    }
    setUp();
    for (const hero of ['Yaarbro', 'Caputo'] as const) screens.setPortrait(hero, view.portrait(hero));
    fit();
    screens.setLoading(null);
    last = performance.now();
    requestAnimationFrame(loop);
  })();
};

boot();
