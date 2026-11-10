// Starts the page and runs the game loop: read the controls, advance the rules
// in fixed steps, draw. The rules live in src/game, the level in src/levels,
// the drawing in src/view. This file only connects them.

import './style.css';
import { Game, IDLE, type GameEvent } from './game/game';
import { STEP } from './game/hero';
import type { Level } from './game/level';
import { Controls } from './input/controls';
import { GROVE_BLURB } from './levels/bouncing-grove/difficulty';
import { buildGrove } from './levels/bouncing-grove/layout';
import { Screens, isTouchDevice, loadChoice, needsTurning, saveChoice, type Choice } from './ui/screens';
import { GroveView } from './view/grove-view';

type Mode = 'start' | 'playing' | 'paused' | 'ended';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const boot = (): void => {
  let view: GroveView;
  try {
    view = new GroveView(canvas);
  } catch {
    document.querySelector<HTMLElement>('#start')!.hidden = true;
    document.querySelector<HTMLElement>('#broken')!.hidden = false;
    return;
  }

  let choice: Choice = loadChoice();
  let level: Level = buildGrove(choice.difficulty);
  let game = new Game(level, choice.difficulty, choice.hero);
  let mode: Mode = 'start';
  let before = { x: game.x, y: game.y, z: game.z };
  let owed = 0;
  let sinceGoal = 0;
  let turned = false;
  const seen = new Set<string>();

  const controls = new Controls(
    document.querySelector<HTMLElement>('#stick-zone')!,
    document.querySelector<HTMLElement>('#stick-base')!,
    document.querySelector<HTMLElement>('#stick-knob')!,
    document.querySelector<HTMLElement>('#jump-zone')!,
  );

  /** Builds the level and hero for the current choice and stands the hero at the start. */
  const setUp = (): void => {
    level = buildGrove(choice.difficulty);
    game = new Game(level, choice.difficulty, choice.hero);
    before = { x: game.x, y: game.y, z: game.z };
    owed = 0;
    sinceGoal = 0;
    seen.clear();
    view.show(level, choice.hero);
    view.snapCamera(game);
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
    setUp();
    screens.setPlace(level.name, choice.difficulty);
    setMode('playing');
    screens.say(
      isTouchDevice() ? 'Left thumb moves. Right thumb jumps.' : 'Arrow keys or W A S D to move. Space to jump.',
      5,
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
    view.resize(width, height);
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
    for (const event of events) {
      if (event.type === 'fall') screens.say('Back to safety…', 2);
      else if (event.type === 'safe') safe = true;
      else if (event.type === 'goal') screens.say(level.goalLine ?? 'You made it!', 4);
    }
    // Each part of the level has one short prompt, shown the first time you stand there.
    const hint = game.groundId && !seen.has(game.groundId) ? level.hints?.[game.groundId] : undefined;
    if (hint && game.groundId) seen.add(game.groundId);
    if (safe && hint) screens.say(`Safe on the mossy bank. ${hint}`, 5);
    else if (safe) screens.say('Safe on the mossy bank.', 2.5);
    else if (hint) screens.say(hint, 4);
  };

  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const running = (mode === 'playing' || mode === 'ended') && !turned;
    if (running) {
      owed += dt;
      let steps = 0;
      while (owed >= STEP && steps < 6) {
        before = { x: game.x, y: game.y, z: game.z };
        game.step(mode === 'playing' ? controls.read() : IDLE);
        // After a fall the hero is somewhere else entirely: do not slide there.
        if (game.events.some((event) => event.type === 'fall')) before = { x: game.x, y: game.y, z: game.z };
        view.handle(game.events);
        narrate(game.events);
        owed -= STEP;
        steps += 1;
      }
      if (steps === 6) owed = 0;
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
    requestAnimationFrame(loop);
  };

  setUp();
  for (const hero of ['Yaarbro', 'Caputo'] as const) screens.setPortrait(hero, view.portrait(hero));
  fit();
  setMode('start');
  requestAnimationFrame(loop);

  // A small window into the running game for the browser checks in tests/browser.
  Object.defineProperty(window, '__grove', {
    value: {
      get game() {
        return game;
      },
      get mode() {
        return mode;
      },
    },
  });
};

boot();
