// The level picker on the start screen: the areas as a row of cards. Each card
// shows, for whoever is playing, which difficulties they have finished and
// their best time on each. Every area is open from the start; nothing is locked.
//
// A card is a picture, the area's name and line, and three marks; in a level
// with huckleberries and hidden leaves, each mark also says what the player
// has collected on that difficulty. Names and
// times go on the page as plain text.

import { pickupCounts } from '../game/collect';
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from '../game/difficulty';
import type { LevelEntry } from '../levels';
import { SPECIES } from '../game/fishing';
import { findsOn, fishBookOf, progressOn, type Player } from '../save/players';
import { SPECIES_NAME } from './fishing-words';
import { formatTime } from './screens';

import type { HeroName } from '../game/hero';
import { showControls } from './controls-help';

export class Picker {
  private readonly cards = new Map<string, { root: HTMLElement; pick: HTMLButtonElement; marks: HTMLElement; fish: HTMLElement | null; ghost: HTMLInputElement; ghostNote: HTMLElement; controls: HTMLElement }>();

  /** How many huckleberries and hidden leaves each level has on each difficulty, counted once. */
  private readonly toFind = new Map<string, Record<Difficulty, { berry: number; leaf: number }>>();

  constructor(
    container: HTMLElement,
    levels: readonly LevelEntry[],
    /** Called when a card is picked that was not the picked one already. */
    private readonly onPick: (level: LevelEntry) => void,
    /** Called when the ghost is switched on or off on the picked card. */
    private readonly onGhost: (on: boolean) => void,
  ) {
    container.dataset.count = String(levels.length);
    for (const level of levels) {
      const count = (difficulty: Difficulty): { berry: number; leaf: number } => pickupCounts(level.build(difficulty).pickups);
      this.toFind.set(level.id, { easy: count('easy'), normal: count('normal'), hard: count('hard') });
    }
    levels.forEach((level, index) => {
      const root = document.createElement('div');
      root.className = 'area';
      root.dataset.level = level.id;
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'area-pick';
      pick.setAttribute('role', 'radio');
      const picture = document.createElement(level.card ? 'img' : 'span');
      picture.className = 'area-picture';
      if (picture instanceof HTMLImageElement) {
        picture.src = level.card!;
        picture.alt = '';
        picture.decoding = 'async';
      }
      const text = document.createElement('span');
      text.className = 'area-text';
      const name = document.createElement('b');
      name.className = 'area-name';
      name.textContent = level.name;
      const lead = document.createElement('small');
      lead.className = 'area-lead';
      lead.textContent = level.lead;
      const marks = document.createElement('span');
      marks.className = 'marks';
      text.append(name, lead, marks);
      // The player's fish book, on the card of a level with somewhere to fish.
      const fish = level.build('easy').fishing ? document.createElement('span') : null;
      if (fish) {
        fish.className = 'fish-book';
        text.append(fish);
      }
      pick.append(picture, text);
      pick.addEventListener('click', () => this.choose(level, false));
      pick.addEventListener('keydown', (event) => {
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!step || levels.length < 2) return;
        event.preventDefault();
        this.choose(levels[(index + step + levels.length) % levels.length], true);
      });
      // The ghost switch, at the foot of the card. Only the picked card shows it.
      const foot = document.createElement('label');
      foot.className = 'ghost-toggle';
      const ghost = document.createElement('input');
      ghost.type = 'checkbox';
      ghost.id = `ghost-${level.id}`;
      ghost.setAttribute('role', 'switch');
      const words = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = 'Race your ghost';
      const ghostNote = document.createElement('small');
      words.append(title, ghostNote);
      foot.append(ghost, words);
      ghost.addEventListener('change', () => this.onGhost(ghost.checked));
      // The controls, before a run starts. Only the picked card shows them.
      const controls = document.createElement('div');
      controls.className = 'area-controls controls';
      controls.setAttribute('aria-label', 'Controls');
      root.append(pick, foot, controls);
      container.append(root);
      this.cards.set(level.id, { root, pick, marks, fish, ghost, ghostNote, controls });
    });
  }

  private picked = '';

  private choose(level: LevelEntry, focus: boolean): void {
    const changed = level.id !== this.picked;
    this.mark(level.id);
    if (focus) this.cards.get(level.id)?.pick.focus();
    if (changed) this.onPick(level);
  }

  /** Shows one card as the picked one. */
  mark(levelId: string): void {
    this.picked = levelId;
    for (const [id, card] of this.cards) {
      const picked = id === levelId;
      card.root.classList.toggle('picked', picked);
      card.pick.setAttribute('aria-checked', String(picked));
      card.pick.tabIndex = picked ? 0 : -1;
    }
  }

  /**
   * Sets the ghost switch on the picked card: whether the ghost is on for the
   * hero and difficulty picked now, and whether there is a best run to race yet.
   */
  showGhost(on: boolean, recorded: boolean): void {
    const card = this.cards.get(this.picked);
    if (!card) return;
    card.ghost.checked = on;
    card.ghostNote.textContent = !on
      ? 'Off. Your best run is still saved.'
      : recorded
        ? 'A see-through copy of your best run runs beside you.'
        : 'Finish a run this way first, then race it.';
  }

  /** Shows the controls on the picked card: for a keyboard or for touch, with the hero's own move by name. */
  showControls(touch: boolean, hero: HeroName): void {
    const card = this.cards.get(this.picked);
    if (card) showControls(card.controls, touch, hero);
  }

  /** Fills every card's marks for a player: finished difficulties and best times. */
  show(player: Player): void {
    for (const [id, card] of this.cards) {
      const progress = progressOn(player, id);
      const finds = findsOn(player, id);
      if (card.fish) {
        const book = fishBookOf(player);
        card.fish.setAttribute('role', 'img');
        card.fish.setAttribute(
          'aria-label',
          `Fish book: ${SPECIES.map((species) => (book[species].count ? `${book[species].count} ${species}, biggest ${book[species].biggest} centimetres` : `no ${species} yet`)).join('; ')}`,
        );
        card.fish.replaceChildren(
          ...SPECIES.map((species) => {
            const { count, biggest } = book[species];
            const entry = document.createElement('span');
            entry.className = 'fish-entry';
            entry.dataset.fish = species;
            entry.dataset.caught = String(count);
            const picture = Object.assign(document.createElement('img'), { src: `fish/${species}.webp`, alt: '', decoding: 'async' });
            const name = document.createElement('b');
            name.textContent = count ? SPECIES_NAME[species] : '?';
            const line = document.createElement('small');
            line.textContent = count ? `${count} · ${biggest} cm` : 'Not yet';
            entry.append(picture, name, line);
            return entry;
          }),
        );
      }
      const toFind = this.toFind.get(id);
      card.marks.replaceChildren(
        ...DIFFICULTIES.map((difficulty) => {
          const { finished, seconds } = progress[difficulty];
          const mark = document.createElement('span');
          mark.className = 'mark';
          mark.dataset.mark = difficulty;
          mark.dataset.finished = String(finished);
          const tick = document.createElement('i');
          tick.textContent = finished ? '✓' : '';
          tick.setAttribute('aria-hidden', 'true');
          const label = document.createElement('span');
          label.className = 'mark-label';
          label.textContent = DIFFICULTY_LABEL[difficulty];
          const time = document.createElement('span');
          time.className = 'mark-time';
          time.textContent = seconds === null ? 'Not yet' : formatTime(seconds);
          mark.append(tick, label, time);
          let collected = '';
          const there = toFind?.[difficulty];
          if (there && there.berry + there.leaf > 0) {
            // What this player has collected here: the most huckleberries in one run, and the hidden leaves found so far.
            const line = document.createElement('span');
            line.className = 'mark-finds';
            line.dataset.finds = difficulty;
            const dot = (kind: string): HTMLElement => Object.assign(document.createElement('i'), { className: kind });
            const { most, leaves } = finds.on[difficulty];
            line.append(dot('berry-dot'), `${most}/${there.berry}`, dot('leaf-dot'), `${leaves}/${there.leaf}`);
            mark.append(line);
            collected = `, most huckleberries in a run ${most} of ${there.berry}, hidden leaves found ${leaves} of ${there.leaf}`;
          }
          mark.setAttribute('role', 'img');
          mark.setAttribute(
            'aria-label',
            (seconds === null ? `${DIFFICULTY_LABEL[difficulty]}: not finished yet` : `${DIFFICULTY_LABEL[difficulty]}: finished, best time ${formatTime(seconds)}`) + collected,
          );
          return mark;
        }),
      );
    }
  }
}
