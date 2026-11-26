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
// What belongs to one level (its music, its sounds, its enemies' models) is
// fetched when that level is picked, with the same progress bar.
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
import { PIKE, pikeFighting, pikeOpen } from './game/pike';
import { ABILITY_NAME } from './game/ability';
import { Game, IDLE, type GameEvent, type Input } from './game/game';
import type { Difficulty } from './game/difficulty';
import type { HeroName } from './game/hero';
import { GhostPlayer, GhostRecorder } from './game/ghost';
import { MOVE_NAME, STEP } from './game/hero';
import { passageNear } from './game/swim';
import type { Level } from './game/level';
import { Controls } from './input/controls';
import { stickToLevel } from './view/route-camera';
import { findLevel, levelFromAddress, listedLevels, shownLevels } from './levels';
import { GhostStore } from './save/ghost-store';
import { loadGhost, saveGhost, type GhostSlot } from './save/ghosts';
import { pickupCounts } from './game/collect';
import { Players, endBests, ghostOn, isBiggestYet, type CatchOutcome, type EndBests, type HaulOutcome, type Player as SavedPlayer } from './save/players';
import { DiveHint, diveHintText } from './ui/dive-hint';
import { fishingButton, fishingHint, fishingNews } from './ui/fishing-words';
import { pikeNews, rescueNews } from './ui/pike-words';
import { onSpot } from './game/fishing';
import { Picker } from './ui/picker';
import { Screens, isTouchDevice, loadChoice, needsTurning, type Choice } from './ui/screens';
import { Who, badge } from './ui/who';
import type { GroveView } from './view/grove-view';

type Mode = 'start' | 'playing' | 'paused' | 'ended';

/**
 * What a preview page can ask of the game, set as `window.__grovePreview`
 * before this file runs (tools/preview/lake.mjs builds one): a level, a place
 * in it to start on, a difficulty and a hero, straight into play with nobody
 * picked and nothing saved; `pilot` plays instead of the controls (the test
 * bot, for "Watch"), `again` says when to start that place over, and `hold`
 * stops the clock for a still picture. Players
 * never have one: the game itself never sets it.
 */
interface PreviewHook {
  level?: string;
  /** True: the hero has the new button (Walblum's kick, Claw Slash), whoever is playing. */
  ability?: boolean;
  at?: string;
  difficulty?: Difficulty;
  hero?: HeroName;
  pilot?: (game: Game) => Input;
  again?: (game: Game) => boolean;
  /** True while the page holds the game still, for a still picture of one moment. */
  hold?: () => boolean;
}
const preview = (window as unknown as { __grovePreview?: PreviewHook }).__grovePreview ?? null;

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const boot = (): void => {
  let view: GroveView | null = null;
  let entry = findLevel(preview?.level) ?? levelFromAddress(window.location.search) ?? listedLevels()[0];
  let choice: Choice = loadChoice();
  if (preview) choice = { hero: preview.hero ?? choice.hero, difficulty: preview.difficulty ?? choice.difficulty };
  let level: Level = entry.build(choice.difficulty);
  let game = new Game(level, choice.difficulty, choice.hero, { ability: Boolean(preview?.ability) });
  /** How many huckleberries and hidden leaves the level that is up has. */
  let toFind = pickupCounts(level.pickups);
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
  sound.setLevel(entry.id);
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
    document.querySelector<HTMLElement>('#attack-button'),
  );

  /** What saving this run's huckleberries and hidden leaves said, for the end card. */
  let endFinds: HaulOutcome | null = null;
  /** What saving this run's catch said, for the end card. */
  let endFish: CatchOutcome | null = null;
  /** The run whose haul has been saved, so each run is saved once. */
  let haulSaved: Game | null = null;
  /**
   * Saves what the run has collected so far for whoever is playing: when it
   * ends, and when it is left or started over. Nothing collected is lost.
   */
  const saveHaul = (): HaulOutcome | null => {
    if (!who || haulSaved === game || preview) return null;
    haulSaved = game;
    const { berries, leaves } = game.summary();
    // The catch goes in the player's fish book with the haul: both are kept whether or not the run is finished.
    endFish = players.land(who.id, game.catches);
    if (Object.keys(endFish.caught).length) picker.show(who);
    return players.collect(who.id, { levelId: entry.id, difficulty: choice.difficulty, berries, leaves });
  };

  /** Whether whoever is playing has won the new button. */
  const hasAbility = (): boolean => Boolean(preview?.ability || (who && players.get(who.id)?.rescued));
  /** Builds the level and hero for the current choice and stands the hero at the start. */
  const setUp = (): void => {
    saveHaul();
    endFinds = null;
    endFish = null;
    level = entry.build(choice.difficulty);
    // The new button is won by rescuing Walblum, and from then on is there from the start of every level.
    game = new Game(level, choice.difficulty, choice.hero, { ability: hasAbility() });
    toFind = pickupCounts(level.pickups);
    if (preview?.at) game.startOn(preview.at);
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
    sound.setLevel(entry.id);
    sound.setMusic(entry.music);
    screens.setBoss(null);
    showLevel();
  };

  /**
   * Counts the levels being fetched: while one is on its way (`fetching`), the
   * picture still holds the level before it, so nothing is drawn and Play is off.
   */
  let asked = 0;
  let fetching = false;
  /** Draws the level that is up. If its models are not here yet (a level picked for the first time), fetches them first. */
  const showLevel = (): void => {
    if (!view) return;
    const mine = ++asked;
    const ready = (): void => {
      fetching = false;
      // The game's own copy of the level: its moving pieces are the ones the rules move.
      view?.show(game.level, choice.hero, entry.scenery);
      view?.snapCamera(game);
    };
    // Yaarbro with the new button brings Walblum: his model comes with whatever level is picked.
    view.companion = game.ability !== null && game.hero === 'Yaarbro';
    if (view.has(game.level)) {
      const waited = fetching;
      ready();
      if (waited) screens.setLoading(null);
      return;
    }
    fetching = true;
    screens.setLoading(0, entry.name);
    view.load(game.level, (share) => {
      if (mine === asked) screens.setLoading(share, entry.name);
    }).then(
      () => {
        // The player may have picked something else while this came down.
        if (mine !== asked) return;
        ready();
        screens.setLoading(null);
      },
      (error: unknown) => {
        console.error(error);
        if (mine === asked) screens.fail('download');
      },
    );
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
    // The controls on the picked card follow the hero picked now (and the pause screen's with them).
    picker.showControls(isTouchDevice(), choice.hero);
    screens.setControls(choice.hero);
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
  showGhostSwitch();

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
    if (!view || fetching) return;
    setUp();
    // Every run is recorded. The player's best run so far is replayed beside
    // it as a ghost, when the ghost is on and there is one. The ghost is only
    // drawn: the rules and the sounds never hear of it.
    recorder = new GhostRecorder(game);
    diveHint.reset();
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
  // Closing the page in the middle of a run keeps what it had collected.
  window.addEventListener('pagehide', () => void saveHaul());
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
    // The monster pike has the same bar: up from the moment it is hooked.
    const pike = game.pike;
    if (pike && (pikeFighting(pike) || (pike.phase === 'beaten' && pike.timer < PIKE.fade))) {
      screens.setBoss({ name: pike.spot.name, health: pike.health, of: pike.spot.numbers.health, open: pikeOpen(pike) });
      return;
    }
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
      if (event.type === 'fishing') {
        // The catch is already on the run's record: everything before its last fish is "earlier".
        const biggest = event.what === 'landed' && isBiggestYet(who, game.catches.slice(0, -1), { species: event.species, size: event.size });
        const words = fishingNews(event, isTouchDevice(), level.fishing?.numbers.snap === Infinity, biggest);
        if (words) news(words.text, words.seconds);
      } else if (event.type === 'fall') screens.say('Back to safety…', 2);
      else if (event.type === 'piece' && event.what === 'snap') news('Snap! Do not stand on a crocodile too long.', 2.5);
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
      } else if (event.type === 'pike') {
        const words = pikeNews(event, level.pike?.name ?? 'The monster', level.pike?.numbers.guarded ?? false);
        if (event.what === 'reset') healedNews = event.healed ? words : null;
        else if (words) news(words, event.what === 'beaten' ? 5 : 3);
      } else if (event.type === 'rescue') {
        const words = rescueNews(event, level.rescue?.name ?? 'Your friend');
        if (words) news(words, 4);
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

  // How to dive: the first time in the water in a run, and again when a swimmer
  // waits at the surface by a passage it can only get through underwater.
  const diveHint = new DiveHint();
  /** Whether the hero stood on the fishing spot on the last frame, to say how to fish on stepping onto it. */
  let wasAtSpot = false;
  const hintDive = (): void => {
    const water = game.water;
    const show = diveHint.step(
      {
        swimming: game.swimming,
        under: game.under,
        entered: game.events.some((event) => event.type === 'splash'),
        nearPassage: water !== null && passageNear(game.level.solids, water, game.x, game.z),
      },
      STEP,
    );
    if (!show) return;
    const touch = isTouchDevice();
    screens.say(diveHintText(touch), 4);
    if (touch) screens.pulseMove(4);
  };

  // The frame counter, shown when the address ends in ?fps.
  const showRate = new URLSearchParams(window.location.search).has('fps');
  let sinceRate = 0;

  let last = performance.now();
  const loop = (now: number): void => {
    if (!view) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const running = (mode === 'playing' || mode === 'ended') && !turned && !preview?.hold?.();
    if (running) {
      owed += dt;
      let steps = 0;
      while (owed >= STEP && steps < 6) {
        before = { x: game.x, y: game.y, z: game.z };
        // The stick follows the camera: up is away from it, whichever way it faces (src/view/route-camera.ts).
        game.step(mode !== 'playing' ? IDLE : preview?.pilot ? preview.pilot(game) : stickToLevel(controls.read(), view.facing));
        // After a fall, or after running out of hearts, the hero is somewhere else entirely: do not slide there.
        if (game.events.some((event) => event.type === 'fall' || event.type === 'restored')) before = { x: game.x, y: game.y, z: game.z };
        view.handle(game.events);
        narrate(game.events);
        hintDive();
        gameSounds.step(game);
        recorder?.step(game);
        owed -= STEP;
        steps += 1;
      }
      if (steps === 6) owed = 0;
      // A preview page starts its place over when it says so.
      if (preview?.again?.(game)) play();
      screens.setHearts(game.hearts, level.hearts);
      // At the fishing spot the round button fishes, and says so.
      const atSpot = Boolean(level.fishing && game.fishing && game.grounded && onSpot(level.fishing, game.groundId, game.x, game.z));
      const fishLabel = game.fishing ? fishingButton(atSpot, game.fishing.phase) : null;
      if (fishLabel) screens.setFishing(fishLabel);
      else screens.setSwimming(game.swimming);
      if (atSpot && !wasAtSpot && game.fishing?.phase === 'off' && game.seconds >= newsUntil) screens.say(fishingHint(isTouchDevice()), 4);
      wasAtSpot = atSpot;
      screens.setLine(game.fishing?.phase === 'hooked' ? { strain: game.fishing.strain, fight: game.fishing.fight } : null);
      screens.setBreath(Number.isFinite(game.maxBreath) && (game.under || game.breath < game.maxBreath) ? game.breath / game.maxBreath : null);
      showBoss();
      // The new button, for a hero who has it: named, and dimmed while Walblum (or the paw) is away.
      screens.setAbility(game.ability ? ABILITY_NAME[game.hero] : null, game.ability?.phase === 'ready');
      screens.setFound(level.pickups?.length ? { berries: game.berries, berriesIn: toFind.berry, leaves: game.leaves, leavesIn: toFind.leaf } : null);
      if (game.complete && mode === 'playing') {
        mode = 'ended';
        sound.stopLoops();
        controls.enabled = false;
        controls.release();
        sinceGoal = 0;
        // What the run collected is saved whether or not it sets a best.
        endFinds = saveHaul();
        // Only a run that reached the golden leaf is saved, for whoever is playing.
        if (who) {
          const { seconds, falls, complete } = game.summary();
          const outcome = players.finish(who.id, { levelId: entry.id, hero: choice.hero, difficulty: choice.difficulty, seconds, falls, complete, course: entry.course });
          // Walblum rescued: remembered for the player. It is what wins the new button, once that is in the game.
          if (game.summary().rescued) players.rescue(who.id);
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
          screens.showEnd(game.summary(), new Date(), endCard, endFinds, endFish);
        }
      }
    }
    const blend = running ? Math.min(owed / STEP, 1) : 1;
    // The ghost runs on the game's own clock, so it starts when the player starts and waits while the game is paused.
    const ghostPose = ghost && mode !== 'start' ? ghost.at(game.seconds - (1 - blend) * STEP) : null;
    // While a level's models are on their way the picture still holds the level before: leave it be.
    if (!fetching) view.frame(game, before, blend, running ? dt : 0, ghostPose);
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
      /** The level's monster pike, if it has one: what is drawn, and what the rules have. */
      get pike() {
        return view && game.pike ? { ...view.pikeInfo(), phase: game.pike.phase, health: game.pike.health } : null;
      },
      /** The new button: what is drawn of it, and what the rules have, or null for a hero without it. */
      get ability() {
        return view && game.ability ? { ...view.abilityInfo(), phase: game.ability.phase, used: game.ability.used } : null;
      },
      /** The level's rescue (Walblum), if it has one: what is drawn, and what the rules have. */
      get rescue() {
        return view && game.rescue ? { ...view.rescueInfo(), phase: game.rescue.phase } : null;
      },
      /** The level's fishing spot, if it has one: what is drawn, and what the rules have (phase, fish, catches). */
      get fishing() {
        return view && game.fishing ? { ...view.fishingInfo(), phase: game.fishing.phase, catches: game.catches.length } : null;
      },
      /** The level's water, if it has any: pools drawn, splashes showing, and how far under the picture is. */
      get water() {
        return view ? view.waterInfo() : null;
      },
      /** The level's crocodile stepping stones as drawn: each one's id, what it is doing and how high it is. */
      get stones() {
        return view ? view.stoneInfo() : [];
      },
      /** The level's ropes as drawn: each one's id and how far it has swung, in radians. */
      get ropes() {
        return view ? view.ropeInfo(game) : [];
      },
      /** Which way the camera faces now, in degrees seen from above (0 looks along -z). */
      get facing() {
        return view ? view.facing : 0;
      },
      /** How many huckleberries and hidden leaves are drawn now, or null in a level with none. */
      get pickups() {
        return view ? view.pickupsShown() : null;
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
      view = await GroveView.create(canvas, (share) => screens.setLoading(0.1 + share * 0.9), level);
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
    // A level picked while the page was loading may still be fetching its own files.
    if (!fetching) screens.setLoading(null);
    // A preview page goes straight into play, with nobody picked.
    if (preview) {
      whoScreen.close();
      const go = (): void => {
        if (fetching) setTimeout(go, 100);
        else play();
      };
      go();
    }
    last = performance.now();
    requestAnimationFrame(loop);
  })();
};

boot();
