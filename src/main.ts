// Starts the page and runs the game loop: read the controls, advance the rules
// in fixed steps, draw. The rules live in src/game, the level in src/levels,
// the drawing in src/view. This file only connects them.
//
// The start screen shows straight away. The 3D code and its files download
// behind it, with a progress bar, and Play switches on when they are ready.

import './style.css';
import { Game, IDLE, type GameEvent } from './game/game';
import { MOVE_NAME, STEP } from './game/hero';
import type { Level } from './game/level';
import { Controls } from './input/controls';
import { GROVE_BLURB } from './levels/bouncing-grove/difficulty';
import { buildGrove } from './levels/bouncing-grove/layout';
import { Screens, isTouchDevice, loadChoice, needsTurning, saveChoice, type Choice } from './ui/screens';
import type { GroveView } from './view/grove-view';

type Mode = 'start' | 'playing' | 'paused' | 'ended';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const boot = (): void => {
  let view: GroveView | null = null;
  let choice: Choice = loadChoice();
  let level: Level = buildGrove(choice.difficulty);
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

  const controls = new Controls(
    document.querySelector<HTMLElement>('#stick-zone')!,
    document.querySelector<HTMLElement>('#stick-base')!,
    document.querySelector<HTMLElement>('#stick-knob')!,
    document.querySelector<HTMLElement>('#jump-zone')!,
    document.querySelector<HTMLElement>('#move-button')!,
  );

  /** Builds the level and hero for the current choice and stands the hero at the start. */
  const setUp = (): void => {
    level = buildGrove(choice.difficulty);
    game = new Game(level, choice.difficulty, choice.hero);
    before = { x: game.x, y: game.y, z: game.z };
    owed = 0;
    sinceGoal = 0;
    seen.clear();
    met.clear();
    newsUntil = 0;
    view?.show(level, choice.hero);
    view?.snapCamera(game);
  };

  const screens = new Screens(choice, GROVE_BLURB, (picked) => {
    const rebuild = picked.difficulty !== choice.difficulty || picked.hero !== choice.hero;
    choice = picked;
    saveChoice(choice);
    if (rebuild) setUp();
  });

  const setMode = (next: Mode): void => {
    mode = next;
    controls.enabled = next === 'playing';
    controls.release();
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
        owed -= STEP;
        steps += 1;
      }
      if (steps === 6) owed = 0;
      screens.setHearts(game.hearts, level.hearts);
      if (game.complete && mode === 'playing') {
        mode = 'ended';
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
