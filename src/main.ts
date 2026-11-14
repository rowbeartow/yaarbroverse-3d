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
// "Who's playing?" comes first: up to four players, each with a name, a
// colour and their own saved choices and progress (src/save/players.ts).
// Nothing about a player leaves this device.
//
// Sound (src/audio) starts on the first tap or key press, because browsers
// block it before that. The Sound button and the M key mute it, and the
// choice is remembered.

import './style.css';
import { GameSounds } from './audio/game-sounds';
import { Sound } from './audio/mix';
import { Player } from './audio/player';
import { bossFighting, bossOpen } from './game/boss';
import { Game, IDLE, type GameEvent } from './game/game';
import { GhostPlayer, GhostRecorder } from './game/ghost';
import { MOVE_NAME, STEP } from './game/hero';
import type { Level } from './game/level';
import { Controls } from './input/controls';
import { levelFromAddress, listedLevels, shownLevels } from './levels';
import { GhostStore } from './save/ghost-store';
import { loadGhost, saveGhost, type GhostSlot } from './save/ghosts';
import { Players, endBests, ghostOn, type EndBests, type Player as SavedPlayer } from './save/players';
import { Picker } from './ui/picker';
import { Screens, isTouchDevice, loadChoice, needsTurning, type Choice } from './ui/screens';
import { Who, badge } from './ui/who';
import type { GroveView } from './view/grove-view';

type Mode = 'start' | 'playing' | 'paused' | 'ended';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const boot = (): void => {
  let view: GroveView | null = null;
  let entry = levelFromAddress(window.location.search) ?? listedLevels()[0];
  let choice: Choice = loadChoice();
  let level: Level = entry.build(choice.difficulty);
  let game = new Game(level, choice.difficulty, choice.hero);
  let mode: Mode = 'start';
  let before = { x: game.x, y: game.y, z: game.z };
  let owed = 0;
  let sinceGoal = 0;
  let turned = false;
  const seen = new Set<string>();
  /** Scouts that have already noticed the hero this run. */
  const met = new Set<string>();
  /** Game time until which a line about hearts or enemies keeps the screen. */
  let newsUntil = 0;
  /** A line about an enemy that healed, waiting for the hero to be back on its feet. */
  let healedNews: string | null = null;

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
  // Ghosts live in the browser's database, which has room for them all (src/save/ghost-store.ts).
  const ghosts = new GhostStore(
    ((): IDBFactory | null => {
      try {
        return window.indexedDB ?? null;
      } catch {
        return null;
      }
    })(),
    memory,
  );
  // The players on this device, and who is playing now. Null until someone is picked.
  const players = new Players(memory, ghosts);
  let who: SavedPlayer | null = null;
  /** The recording being made of this run, and the player's best run being replayed beside it (null when off, or none yet). */
  let recorder: GhostRecorder | null = null;
  let ghost: GhostPlayer | null = null;
  /** What the end card says about the player's bests after the run just finished. */
  let endCard: EndBests | null = null;
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
    endCard = null;
    recorder = null;
    ghost = null;
    seen.clear();
    met.clear();
    newsUntil = 0;
    healedNews = null;
    gameSounds.reset();
    // A fight that was on is over: the level's own music again, and no health bar.
    sound.setMusic(entry.music);
    screens.setBoss(null);
    // The game's own copy of the level: its moving pieces are the ones the rules move.
    view?.show(game.level, choice.hero, entry.scenery);
    view?.snapCamera(game);
  };

  const screens = new Screens(choice, entry, (picked) => {
    const rebuild = picked.difficulty !== choice.difficulty || picked.hero !== choice.hero;
    choice = picked;
    if (who) players.setChoice(who.id, choice.hero, choice.difficulty);
    if (rebuild) setUp();
    showGhostSwitch();
  });

  /** Where the ghost for the level, hero and difficulty picked now is kept, for whoever is playing. */
  const ghostSlot = (): GhostSlot | null =>
    who ? { playerId: who.id, levelId: entry.id, hero: choice.hero, difficulty: choice.difficulty } : null;
  /** The ghost switch on the picked card follows the player, hero and difficulty picked now. */
  const showGhostSwitch = (): void => {
    const slot = ghostSlot();
    if (who && slot) picker.showGhost(ghostOn(who, choice.difficulty), loadGhost(ghosts, slot) !== null);
  };
  // The database opens in a moment; then the ghost switch knows whether there is a ghost to race.
  void ghosts.open().then(showGhostSwitch);

  // The level picker: a card for each area. Picking another builds that level and plays its music.
  const picker = new Picker(document.querySelector<HTMLElement>('#areas')!, shownLevels(window.location.search), (picked) => {
    entry = picked;
    screens.setLevel(entry);
    sound.setMusic(entry.music);
    setUp();
    showGhostSwitch();
  }, (on) => {
    if (who) players.setGhost(who.id, choice.difficulty, on);
    showGhostSwitch();
  });
  picker.mark(entry.id);

  // "Who's playing?": picking a player brings up the start screen with their own hero and difficulty.
  const whoScreen = new Who(
    players,
    (picked) => {
      const now = players.choose(picked.id) ?? picked;
      who = now;
      const rebuild = now.difficulty !== choice.difficulty || now.hero !== choice.hero;
      choice = { hero: now.hero, difficulty: now.difficulty };
      screens.setChoice(choice);
      screens.setPlayer(now.name, badge(now));
      if (rebuild) setUp();
      whoScreen.close();
      setMode('start');
    },
    () => {
      // The player who was playing may have been removed.
      if (who && !players.get(who.id)) who = null;
    },
  );
  const askWho = (): void => {
    screens.show('who');
    whoScreen.open();
  };

  const setMode = (next: Mode): void => {
    mode = next;
    controls.enabled = next === 'playing';
    controls.release();
    // The roll and the mosquito's whine stop with the game.
    if (next !== 'playing') sound.stopLoops();
    // Nobody is picked yet on a fresh page: "Who's playing?" comes before the start screen.
    if (next === 'start' && !who) askWho();
    else if (next === 'start') {
      // The cards show the player's progress as it stands now, a run just finished included.
      if (who) picker.show(who);
      showGhostSwitch();
      screens.show('start');
    }
    else if (next === 'paused') screens.show('paused');
    else if (next === 'playing') screens.show('none');
  };

  const play = (): void => {
    if (!view) return;
    setUp();
    // Every run is recorded. The player's best run so far is replayed beside
    // it as a ghost, when the ghost is on and there is one. The ghost is only
    // drawn: the rules and the sounds never hear of it.
    recorder = new GhostRecorder(game);
    const slot = ghostSlot();
    const best = who && slot && ghostOn(who, choice.difficulty) ? loadGhost(ghosts, slot) : null;
    ghost = best ? new GhostPlayer(best) : null;
    view.setGhost(ghost ? choice.hero : null);
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
  document.querySelector('#switch-player')!.addEventListener('click', askWho);
  document.querySelector('#pause')!.addEventListener('click', pause);
  document.querySelector('#resume')!.addEventListener('click', () => setMode('playing'));
  document.querySelector('#restart')!.addEventListener('click', play);
  document.querySelector('#quit')!.addEventListener('click', () => {
    setUp();
    setMode('start');
  });
  document.querySelector('#reload')!.addEventListener('click', () => window.location.reload());
  window.addEventListener('keydown', (event) => {
    // Typing a name is not a key press for the game.
    if (event.target instanceof HTMLInputElement) return;
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

  /** The boss's health bar: up from the moment its fight begins, and until a moment after it is beaten. */
  const showBoss = (): void => {
    const boss = game.boss;
    const shown = boss && (bossFighting(boss) || (boss.phase === 'defeated' && boss.timer < 2.5));
    screens.setBoss(boss && shown ? { name: boss.spot.name, health: boss.health, of: boss.spot.numbers.health, open: bossOpen(boss) && boss.phase !== 'intro' } : null);
  };

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
      else if (event.type === 'breathless') news('Out of breath! Back to safety.', 2.5);
      else if (event.type === 'restored') news(`Safe again, with all ${level.hearts} hearts.`, 3);
      else if (event.type === 'enemy' && event.phase === 'idle' && event.kind === 'marmot' && !met.has(event.id)) {
        // The first time a scout notices the hero.
        met.add(event.id);
        // A scout that walks a beat was in plain view; one that hides was not.
        news(level.enemyTuning?.patrolSpeed ? 'The marmot scout has spotted you!' : 'A rustle in the roots… Marmot scout!', 2.5);
      } else if (event.type === 'strike') {
        const name = event.kind === 'marmot' ? 'Marmot' : 'Mosquito';
        news(event.left > 0 ? `${name} hit! ${event.left} more to go.` : `${name} sent packing!`, 2.5);
      } else if (event.type === 'healed') {
        // The older player's rule. It follows "Back to safety" on the screen, so it waits a moment.
        healedNews = event.kind === 'marmot' ? 'The marmot scout is back to full strength.' : 'The mosquito is back to full strength.';
      } else if (event.type === 'boss') {
        const name = level.boss?.name ?? 'The boss';
        if (event.what === 'begin') {
          news(`${name}!`, 2.5);
          // Its music takes over for as long as the fight is on.
          if (entry.bossMusic) sound.setMusic(entry.bossMusic);
        } else if (event.what === 'hit' && event.left > 0) news(`${name} hit! ${event.left} more to go.`, 2.5);
        else if (event.what === 'blocked') news('It shrugs that off. Hit it while it rests!', 2.5);
        else if (event.what === 'stage') news(`${name} is getting angry!`, 2.5);
        else if (event.what === 'call') news(`${name} calls its sidekicks!`, 2.5);
        else if (event.what === 'beaten') {
          news(`${name} is beaten! The golden leaf is yours.`, 5);
          sound.setMusic(entry.music);
        } else if (event.what === 'reset' && event.healed) healedNews = `${name} is back to full strength.`;
      } else if (event.type === 'safe') safe = true;
      else if (event.type === 'goal') screens.say(level.goalLine ?? 'You made it!', 4);
    }
    if (healedNews && game.returning === 0 && game.seconds >= newsUntil) {
      news(healedNews, 3);
      healedNews = null;
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
        recorder?.step(game);
        owed -= STEP;
        steps += 1;
      }
      if (steps === 6) owed = 0;
      screens.setHearts(game.hearts, level.hearts);
      screens.setBreath(Number.isFinite(game.maxBreath) && (game.under || game.breath < game.maxBreath) ? game.breath / game.maxBreath : null);
      showBoss();
      if (game.complete && mode === 'playing') {
        mode = 'ended';
        sound.stopLoops();
        controls.enabled = false;
        controls.release();
        sinceGoal = 0;
        // Only a run that reached the golden leaf is saved, for whoever is playing.
        if (who) {
          const { seconds, falls, complete } = game.summary();
          const outcome = players.finish(who.id, { levelId: entry.id, hero: choice.hero, difficulty: choice.difficulty, seconds, falls, complete });
          endCard = endBests(outcome);
          // The ghost is the recording of the best time: a new best takes its place.
          const slot = ghostSlot();
          if (outcome.bestTime && slot && recorder) saveGhost(ghosts, slot, recorder.finish(game));
        }
      }
      if (mode === 'ended' && screens.end.hidden) {
        sinceGoal += dt;
        if (sinceGoal > 1.6) {
          screens.hush();
          screens.showEnd(game.summary(), new Date(), endCard);
        }
      }
    }
    const blend = running ? Math.min(owed / STEP, 1) : 1;
    // The ghost runs on the game's own clock, so it starts when the player starts and waits while the game is paused.
    const ghostPose = ghost && mode !== 'start' ? ghost.at(game.seconds - (1 - blend) * STEP) : null;
    view.frame(game, before, blend, running ? dt : 0, ghostPose);
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
      /** Whether a player has been picked, and how many are on this device. Never their names. */
      get players() {
        return { picked: who !== null, count: players.list().length };
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
      /** The ghost on screen, if one is being raced: whether it is drawn, where, and how long its run took. */
      get ghost() {
        const info = view?.ghostInfo() ?? null;
        return info && ghost ? { ...info, seconds: ghost.seconds } : null;
      },
      get enemies() {
        return view ? view.enemyInfo() : [];
      },
      /** The boss on screen, if the level has one, and whether the golden leaf is drawn. */
      get boss() {
        return view ? view.bossInfo() : null;
      },
      get leafShown() {
        return view ? view.leafShown() : false;
      },
      /** The music asked for now. */
      get music() {
        return sound.musicName;
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
      whoScreen.close();
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
