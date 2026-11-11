// The parts of the page around the 3D picture: start screen, pause, end card,
// the "turn sideways" card and the short messages while playing. Plain web
// page elements over the canvas, so text stays sharp and screen readers work.

import { DIFFICULTIES, DIFFICULTY_LABEL, isDifficulty, type Difficulty } from '../game/difficulty';
import type { Summary } from '../game/game';
import { HEROES, isHeroName, type HeroName } from '../game/hero';

export interface Choice {
  hero: HeroName;
  difficulty: Difficulty;
}

const STORAGE_KEY = 'yaarbroverse-3d:choice';

/** The hero and difficulty this device last chose. Falls back quietly if storage is blocked. */
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

export const saveChoice = (choice: Choice): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Nothing to do: see loadChoice.
  }
};

/** Play time as minutes, seconds and tenths: 1:07.4 */
export const formatTime = (seconds: number): string => {
  const tenths = Math.floor(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${String(Math.floor(rest / 10)).padStart(2, '0')}.${rest % 10}`;
};

/** True on phones and tablets, where the game shows touch controls. */
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
  private heartsShown = '';
  private readonly play = el<HTMLButtonElement>('#play');
  private messageTimer = 0;

  constructor(
    private choice: Choice,
    blurbs: Record<Difficulty, string>,
    private readonly onChoice: (choice: Choice) => void,
  ) {
    for (const difficulty of DIFFICULTIES) {
      el(`[data-difficulty="${difficulty}"] small`).textContent = blurbs[difficulty];
    }
    this.radioGroup('.heroes', 'hero', HEROES, () => this.choice.hero, (hero) => ({ ...this.choice, hero }));
    this.radioGroup('.levels', 'difficulty', DIFFICULTIES, () => this.choice.difficulty, (difficulty) => ({
      ...this.choice,
      difficulty,
    }));
    el('#controls-note').textContent = isTouchDevice()
      ? 'Left thumb moves. Right thumb jumps: hold for a higher jump. The smaller button above Jump is Yaarbro’s roll or Caputo’s pounce.'
      : 'Arrow keys or W A S D to move. Space to jump: hold for a higher jump. X or Shift for Yaarbro’s roll or Caputo’s pounce. Esc to pause.';
  }

  /** Wires one row of choice buttons: click or arrow keys pick, one is always picked. */
  private radioGroup<T extends string>(
    selector: string,
    attribute: string,
    values: readonly T[],
    current: () => T,
    apply: (value: T) => Choice,
  ): void {
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
  }

  /**
   * The progress bar on the start screen while the 3D picture downloads.
   * A number from 0 to 1 moves the bar; null means done, and Play switches on.
   */
  setLoading(share: number | null): void {
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
    el('#loading-text').textContent = `Loading the grove… ${percent}%`;
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

  /** Shows exactly one of the big screens, or none while playing. */
  show(screen: 'start' | 'paused' | 'end' | 'none'): void {
    this.start.hidden = screen !== 'start';
    this.paused.hidden = screen !== 'paused';
    this.end.hidden = screen !== 'end';
    const playing = screen === 'none' || screen === 'paused';
    this.hud.hidden = !playing;
    this.touch.hidden = !(screen === 'none' && isTouchDevice());
    const focus = { start: '#play', paused: '#resume', end: '#again', none: '' }[screen];
    if (focus) el(focus).focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur();
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

  /** Names the touch button for the hero's own move: Roll or Pounce. */
  setMove(name: string): void {
    const button = el('#move-button');
    button.textContent = name;
    button.setAttribute('aria-label', name);
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

  /** Fills in the end card from the run record. */
  showEnd(summary: Summary, date: Date): void {
    el('#end-difficulty').textContent = DIFFICULTY_LABEL[summary.difficulty];
    el('#end-hero').textContent = summary.hero;
    el('#end-time').textContent = formatTime(summary.seconds);
    el('#end-falls').textContent = String(summary.falls);
    el('#end-hearts').textContent = String(summary.heartsLost);
    el('#end-date').textContent = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    this.show('end');
  }
}
