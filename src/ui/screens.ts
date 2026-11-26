// The parts of the page around the 3D picture: start screen, pause, end card,
// the "turn sideways" card and the short messages while playing. Plain web
// page elements over the canvas, so text stays sharp and screen readers work.

import type { Species } from '../game/fishing';
import { biggestWords, catchWords } from './fishing-words';
import { showControls } from './controls-help';
import { DIFFICULTIES, DIFFICULTY_LABEL, isDifficulty, type Difficulty } from '../game/difficulty';
import type { Summary } from '../game/game';
import { HEROES, isHeroName, type HeroName } from '../game/hero';
import type { EndBests, CatchOutcome, HaulOutcome } from '../save/players';

export interface Choice {
  hero: HeroName;
  difficulty: Difficulty;
}

const STORAGE_KEY = 'yaarbroverse-3d:choice';

/**
 * The hero and difficulty this device chose before there were players. It is
 * what the game is built with until a player is picked, and what a first
 * player starts from. Falls back quietly if storage is blocked.
 */
export const loadChoice = (): Choice => {
  const fallback: Choice = { hero: 'Yaarbro', difficulty: 'normal' };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const { hero, difficulty } = saved as Record<string, unknown>;
      return {
        hero: isHeroName(hero) ? hero : fallback.hero,
        difficulty: isDifficulty(difficulty) ? difficulty : fallback.difficulty,
      };
    }
  } catch {
    // Private windows and blocked storage: the game still works, it just forgets.
  }
  return fallback;
};

/** Play time as minutes, seconds and tenths: 1:07.4 */
export const formatTime = (seconds: number): string => {
  const tenths = Math.floor(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${String(Math.floor(rest / 10)).padStart(2, '0')}.${rest % 10}`;
};

/** True on phones and tablets, where the game shows touch controls. */
/** An arrow going down into waves: the dive mark on the round button. */
const DIVE_MARK =
  '<svg viewBox="0 0 32 32" width="26" height="26"><path d="M16 3v14m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 23c3-2.5 5.5-2.5 8.5 0s5.5 2.5 8.5 0 5.5-2.5 8.5 0M3 29c3-2.5 5.5-2.5 8.5 0s5.5 2.5 8.5 0 5.5-2.5 8.5 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

export const isTouchDevice = (): boolean =>
  navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;

/**
 * True when a touch device's screen is taller than it is wide. That covers a
 * device held upright and also one turned sideways while its screen is locked
 * upright, because in both cases the page itself stays tall.
 */
export const needsTurning = (touch: boolean, width: number, height: number): boolean => touch && height > width;

const el = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing page element ${selector}`);
  return found;
};

export class Screens {
  readonly start = el('#start');
  readonly paused = el('#paused');
  readonly end = el('#end');
  readonly rotate = el('#rotate');
  readonly broken = el('#broken');
  readonly hud = el('#hud');
  readonly touch = el('#touch');
  private readonly message = el('#message');
  private readonly place = el('#place');
  private readonly hearts = el('#hearts');
  private readonly boss = el('#boss');
  private readonly bossName = el('#boss-name');
  private readonly bossHealth = el('#boss-health');
  private bossShown = '';
  private heartsShown = '';
  private foundShown = '';
  private readonly play = el<HTMLButtonElement>('#play');
  private messageTimer = 0;
  private readonly marks: Array<() => void> = [];

  constructor(
    private choice: Choice,
    level: { name: string; blurbs: Record<Difficulty, string> },
    private readonly onChoice: (choice: Choice) => void,
  ) {
    this.setLevel(level);
    this.marks.push(this.radioGroup('.heroes', 'hero', HEROES, () => this.choice.hero, (hero) => ({ ...this.choice, hero })));
    this.marks.push(
      this.radioGroup('.levels', 'difficulty', DIFFICULTIES, () => this.choice.difficulty, (difficulty) => ({
        ...this.choice,
        difficulty,
      })),
    );
  }

  /** The picked level's name on the end card, and its line for each difficulty. */
  setLevel(level: { name: string; blurbs: Record<Difficulty, string> }): void {
    el('#end-level').textContent = level.name;
    for (const difficulty of DIFFICULTIES) {
      el(`[data-difficulty="${difficulty}"] small`).textContent = level.blurbs[difficulty];
    }
  }

  /** Wires one row of choice buttons: click or arrow keys pick, one is always picked. */
  private radioGroup<T extends string>(
    selector: string,
    attribute: string,
    values: readonly T[],
    current: () => T,
    apply: (value: T) => Choice,
  ): () => void {
    const buttons = values.map((value) => el<HTMLButtonElement>(`${selector} [data-${attribute}="${value}"]`));
    const mark = (): void => {
      buttons.forEach((button, i) => {
        const picked = values[i] === current();
        button.setAttribute('aria-checked', String(picked));
        button.tabIndex = picked ? 0 : -1;
      });
    };
    const pick = (index: number, focus: boolean): void => {
      this.choice = apply(values[index]);
      mark();
      if (focus) buttons[index].focus();
      this.onChoice(this.choice);
    };
    buttons.forEach((button, i) => {
      button.addEventListener('click', () => pick(i, false));
      button.addEventListener('keydown', (event) => {
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        pick((i + step + buttons.length) % buttons.length, true);
      });
    });
    mark();
    return mark;
  }

  /** Shows a hero and difficulty as picked, without reporting it as a new choice: a player's own, when they are picked. */
  setChoice(choice: Choice): void {
    this.choice = choice;
    for (const mark of this.marks) mark();
  }

  /** Who is playing, on the start screen. The name goes on the page as plain text. */
  setPlayer(name: string, badge: HTMLElement): void {
    el('#player-badge').replaceChildren(badge);
    el('#player-name').textContent = name;
    el('#switch-player').setAttribute('aria-label', `${name} is playing. Switch player.`);
  }

  /**
   * The progress bar on the start screen while the 3D picture downloads.
   * A number from 0 to 1 moves the bar; null means done, and Play switches on.
   * It comes back for a moment when a level is picked for the first time,
   * while that level's own files arrive; `what` is then the level's name.
   */
  setLoading(share: number | null, what = 'the game'): void {
    const loading = el('#loading');
    if (share === null) {
      loading.hidden = true;
      this.play.disabled = false;
      if (!this.start.hidden) this.play.focus({ preventScroll: true });
      return;
    }
    const percent = Math.round(Math.min(Math.max(share, 0), 1) * 100);
    loading.hidden = false;
    this.play.disabled = true;
    el<HTMLProgressElement>('#loading-bar').value = percent;
    el('#loading-text').textContent = `Loading ${what}… ${percent}%`;
  }

  /** The game cannot start: this browser has no 3D, or a file did not arrive. */
  fail(reason: 'no-3d' | 'download'): void {
    this.start.hidden = true;
    (reason === 'no-3d' ? this.broken : el('#failed')).hidden = false;
  }

  /** The frame counter, shown when the address ends in ?fps. */
  showRate(stats: { framesPerSecond: number; tier: string; automatic: boolean; pixelRatio: number; drawCalls: number; triangles: number }): void {
    const counter = el('#fps');
    counter.hidden = false;
    counter.textContent =
      `${Math.round(stats.framesPerSecond)} fps · ${stats.tier}${stats.automatic ? '' : ' (fixed)'} · ` +
      `${stats.pixelRatio.toFixed(2)}x · ${stats.drawCalls} draws · ${Math.round(stats.triangles / 1000)}k triangles`;
  }

  setPortrait(hero: HeroName, picture: string): void {
    el<HTMLImageElement>(`[data-hero="${hero}"] img`).src = picture;
  }

  /** Shows exactly one of the big screens, or none while playing. "Who's playing?" (src/ui/who.ts) opens and closes itself. */
  show(screen: 'who' | 'start' | 'paused' | 'end' | 'none'): void {
    this.start.hidden = screen !== 'start';
    this.paused.hidden = screen !== 'paused';
    this.end.hidden = screen !== 'end';
    const playing = screen === 'none' || screen === 'paused';
    this.hud.hidden = !playing;
    this.touch.hidden = !(screen === 'none' && isTouchDevice());
    const focus = { who: '', start: '#play', paused: '#resume', end: '#again', none: '' }[screen];
    if (focus) el(focus).focus({ preventScroll: true });
    else if (screen === 'none') (document.activeElement as HTMLElement | null)?.blur();
  }

  setPlace(levelName: string, difficulty: Difficulty): void {
    this.place.textContent = `${levelName} · ${DIFFICULTY_LABEL[difficulty]}`;
  }

  /**
   * Shows the hearts: `left` red ones, then dark outlines up to `of`. Call it
   * as often as you like; the page only changes when the numbers do.
   */
  setHearts(left: number, of: number): void {
    const key = `${left}/${of}`;
    if (key === this.heartsShown) return;
    const lostOne = this.heartsShown !== '' && left < Number(this.heartsShown.split('/')[0]);
    this.heartsShown = key;
    const heart = (full: boolean): string =>
      `<svg class="${full ? 'full' : 'lost'}" viewBox="0 0 32 32" aria-hidden="true"><path stroke-width="2" stroke-linejoin="round" d="M16 28 C6 20 2.5 15 2.5 10 a7 7 0 0 1 13.5 -2.6 a7 7 0 0 1 13.5 2.6 c0 5 -3.5 10 -13.5 18z"/></svg>`;
    this.hearts.innerHTML = Array.from({ length: of }, (_, i) => heart(i < left)).join('');
    this.hearts.setAttribute('aria-label', `${left} of ${of} hearts`);
    this.hearts.dataset.left = String(left);
    this.hearts.dataset.of = String(of);
    if (lostOne) {
      // Restart the little jolt each time a heart goes.
      this.hearts.classList.remove('hit');
      void this.hearts.offsetWidth;
      this.hearts.classList.add('hit');
    }
  }

  /**
   * Shows what this run has collected, or hides the counter (null) in a level
   * with nothing to collect. Each pair is how many found, of how many there are.
   */
  setFound(found: { berries: number; berriesIn: number; leaves: number; leavesIn: number } | null): void {
    const box = el('#found');
    const key = found ? `${found.berries}/${found.berriesIn}/${found.leaves}/${found.leavesIn}` : '';
    if (key === this.foundShown) return;
    const more = this.foundShown !== '' && key !== '' && !key.startsWith('0/');
    this.foundShown = key;
    box.hidden = !found;
    if (!found) return;
    el('#found-berries').textContent = `${found.berries}/${found.berriesIn}`;
    // A level with no hidden leaves shows huckleberries alone.
    const leaves = found.leavesIn > 0;
    el('#found-leaves').hidden = !leaves;
    (box.querySelector('.leaf-dot') as HTMLElement).hidden = !leaves;
    el('#found-leaves').textContent = `${found.leaves}/${found.leavesIn}`;
    box.setAttribute('aria-label', `${found.berries} of ${found.berriesIn} huckleberries${leaves ? `, ${found.leaves} of ${found.leavesIn} hidden leaves` : ''}`);
    if (more) {
      box.classList.remove('got');
      void box.offsetWidth;
      box.classList.add('got');
    }
  }

  /**
   * Shows how much breath is left, as a share of full (0 to 1), or hides the
   * bar (null): it is shown only while breath is running down or filling again.
   */
  setBreath(share: number | null): void {
    const bar = el('#breath');
    if (share === null) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    el('#breath-left').style.transform = `scaleX(${Math.max(0, Math.min(1, share)).toFixed(3)})`;
    bar.classList.toggle('low', share < 0.25);
    bar.setAttribute('aria-label', `Breath ${Math.round(share * 100)} percent`);
    bar.dataset.share = share.toFixed(2);
  }

  /** Names the touch button for the hero's own move: Roll or Pounce. */
  setMove(name: string): void {
    this.moveName = name;
    this.moveShown = '';
    this.setSwimming(false);
  }

  private moveName = '';
  private moveShown = '';
  private pulseTimer = 0;

  /**
   * In the water the round button dives, so it says so: a dive mark (an
   * arrow going down into waves) and "Dive". Out of the water it is the
   * hero's own move again. The page only changes when this does.
   */
  setSwimming(swimming: boolean): void {
    const key = swimming ? 'dive' : this.moveName;
    if (key === this.moveShown) return;
    this.moveShown = key;
    const button = el('#move-button');
    button.dataset.dive = String(swimming);
    if (swimming) {
      button.innerHTML = `<span class="dive-mark" aria-hidden="true">${DIVE_MARK}</span><span>Dive</span>`;
      button.setAttribute('aria-label', 'Dive');
    } else {
      button.textContent = this.moveName;
      button.setAttribute('aria-label', this.moveName);
      button.classList.remove('pulse');
    }
  }

  /**
   * At the fishing spot the round button fishes, so it says what it does now
   * (Fish, Cast, Hook!, Reel). Call `setSwimming` instead when it does not.
   */
  setFishing(label: string): void {
    const key = `fish:${label}`;
    if (key === this.moveShown) return;
    this.moveShown = key;
    const button = el('#move-button');
    button.dataset.dive = 'false';
    button.textContent = label;
    button.setAttribute('aria-label', label);
    button.classList.toggle('pulse', label === 'Hook!');
  }

  /**
   * The fishing line while a fish is hooked: how strained it is (0 to 1) and
   * what the fish is doing, or null to hide the bar.
   */
  setLine(line: { strain: number; fight: 'calm' | 'tell' | 'thrash' } | null): void {
    const bar = el('#line');
    if (line === null) {
      if (!bar.hidden) bar.hidden = true;
      return;
    }
    bar.hidden = false;
    el('#line-strain').style.transform = `scaleX(${Math.max(0.06, Math.min(1, line.strain)).toFixed(3)})`;
    bar.classList.toggle('tell', line.fight === 'tell');
    bar.classList.toggle('thrash', line.fight === 'thrash');
    bar.setAttribute('aria-label', line.fight === 'thrash' ? 'The fish is thrashing: let the line run' : 'The fish is tiring: reel');
    bar.dataset.fight = line.fight;
  }

  /** The controls on the pause screen, for this device and hero. */
  setControls(hero: HeroName): void {
    showControls(el('#paused-controls'), isTouchDevice(), hero);
  }

  /** Makes the round button pulse for a few seconds, to show where diving is. */
  pulseMove(seconds = 4): void {
    const button = el('#move-button');
    button.classList.remove('pulse');
    void button.offsetWidth;
    button.classList.add('pulse');
    window.clearTimeout(this.pulseTimer);
    this.pulseTimer = window.setTimeout(() => button.classList.remove('pulse'), seconds * 1000);
  }

  /**
   * A boss's health bar: its name over one pip for each hit it takes. Null
   * hides it. `open` lights the pips while a hit would count.
   */
  setBoss(boss: { name: string; health: number; of: number; open: boolean } | null): void {
    const key = boss ? `${boss.name}/${boss.health}/${boss.of}/${boss.open}` : '';
    if (key === this.bossShown) return;
    const before = this.bossShown.split('/');
    const hit = boss !== null && before.length === 4 && before[0] === boss.name && boss.health < Number(before[1]);
    this.bossShown = key;
    this.boss.hidden = boss === null;
    if (!boss) return;
    this.bossName.textContent = boss.name;
    this.bossHealth.innerHTML = Array.from({ length: boss.of }, (_, i) => `<span class="${i < boss.health ? 'full' : ''}"></span>`).join('');
    this.bossHealth.setAttribute('aria-label', `${boss.name}: ${boss.health} of ${boss.of} health`);
    this.boss.dataset.health = String(boss.health);
    this.boss.dataset.of = String(boss.of);
    this.boss.classList.toggle('open', boss.open);
    if (hit) {
      this.boss.classList.remove('hit');
      void this.boss.offsetWidth;
      this.boss.classList.add('hit');
    }
  }

  /** Shows a short line near the top for a few seconds. */
  say(text: string, seconds = 3.5): void {
    this.message.textContent = text;
    this.message.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('show'), seconds * 1000);
  }

  hush(): void {
    window.clearTimeout(this.messageTimer);
    this.message.classList.remove('show');
  }

  /**
   * Fills in the end card from the run record. `bests` is the player's best
   * time and fewest falls for this level, hero and difficulty as they stand
   * after the run; a best this run set is marked "New best". Null shows none.
   */
  /**
   * `finds` is what saving the run's haul said, for whoever is playing: whether
   * it was their most huckleberries in a run, how many hidden leaves were new
   * to them, and how many they have now found on this difficulty.
   */
  showEnd(summary: Summary, date: Date, bests: EndBests | null = null, finds: HaulOutcome | null = null, fish: CatchOutcome | null = null): void {
    // The run's catch, where the level has fishing: what was landed, and any biggest it set in the player's fish book.
    const caught: Partial<Record<Species, number>> = {};
    for (const each of summary.fish) caught[each.species] = (caught[each.species] ?? 0) + 1;
    // Who the run rescued, where the level ends with a rescue.
    el('#end-rescue-box').hidden = !summary.rescued;
    el('#end-rescue').textContent = summary.rescued ? (summary.rescuedName ?? '') : '';
    el('#end-fish-box').hidden = !summary.fishing;
    el('#end-fish').textContent = catchWords(caught) || 'None';
    const records = fish ? biggestWords(fish.biggest) : '';
    el('#end-fish-box').classList.toggle('is-new', records !== '');
    el('#end-fish-best').textContent = records;
    el('#end-berries-box').hidden = summary.berriesIn === 0;
    el('#end-leaves-box').hidden = summary.leavesIn === 0;
    el('#end-berries').textContent = `${summary.berries} of ${summary.berriesIn}`;
    el('#end-leaves').textContent = `${summary.leaves.length} of ${summary.leavesIn}`;
    el('#end-berries-box').classList.toggle('is-new', Boolean(finds?.mostBerries));
    el('#end-berries-best').textContent = finds?.mostBerries ? 'Your most yet!' : '';
    el('#end-leaves-box').classList.toggle('is-new', Boolean(finds && finds.newLeaves > 0));
    el('#end-leaves-best').textContent = !finds || summary.leavesIn === 0 ? '' : finds.newLeaves > 0 ? `New! ${finds.leavesFound} of ${summary.leavesIn} found so far` : `${finds.leavesFound} of ${summary.leavesIn} found so far`;
    const banner = el('#end-new');
    banner.hidden = !bests?.headline;
    banner.textContent = bests?.headline ?? '';
    const line = (id: string, best: { value: number; isNew: boolean } | undefined, text: (value: number) => string): void => {
      const box = el(`#end-${id}-box`);
      const note = el(`#end-${id}-best`);
      box.classList.toggle('is-new', Boolean(best?.isNew));
      note.hidden = !best;
      note.textContent = !best ? '' : best.isNew ? 'New best!' : text(best.value);
    };
    line('time', bests?.time, (seconds) => `Best ${formatTime(seconds)}`);
    line('falls', bests?.falls, (falls) => `Fewest ${falls}`);
    el('#end-difficulty').textContent = DIFFICULTY_LABEL[summary.difficulty];
    el('#end-hero').textContent = summary.hero;
    el('#end-time').textContent = formatTime(summary.seconds);
    el('#end-falls').textContent = String(summary.falls);
    el('#end-hearts').textContent = String(summary.heartsLost);
    el('#end-date').textContent = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    this.show('end');
  }
}
