// The level picker on the start screen: the areas as a row of cards. Each card
// shows, for whoever is playing, which difficulties they have finished and
// their best time on each. Every area is open from the start; nothing is locked.
//
// A card is a picture, the area's name and line, and three marks. Names and
// times go on the page as plain text.

import { DIFFICULTIES, DIFFICULTY_LABEL } from '../game/difficulty';
import type { LevelEntry } from '../levels';
import { progressOn, type Player } from '../save/players';
import { formatTime } from './screens';

export class Picker {
  private readonly cards = new Map<string, { root: HTMLElement; pick: HTMLButtonElement; marks: HTMLElement }>();

  constructor(
    container: HTMLElement,
    levels: readonly LevelEntry[],
    /** Called when a card is picked that was not the picked one already. */
    private readonly onPick: (level: LevelEntry) => void,
  ) {
    container.dataset.count = String(levels.length);
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
      pick.append(picture, text);
      pick.addEventListener('click', () => this.choose(level, false));
      pick.addEventListener('keydown', (event) => {
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!step || levels.length < 2) return;
        event.preventDefault();
        this.choose(levels[(index + step + levels.length) % levels.length], true);
      });
      root.append(pick);
      container.append(root);
      this.cards.set(level.id, { root, pick, marks });
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
      card.pick.setAttribute('aria-checked', String(picked));
      card.pick.tabIndex = picked ? 0 : -1;
    }
  }

  /** Fills every card's marks for a player: finished difficulties and best times. */
  show(player: Player): void {
    for (const [id, card] of this.cards) {
      const progress = progressOn(player, id);
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
          mark.setAttribute('role', 'img');
          mark.setAttribute(
            'aria-label',
            seconds === null ? `${DIFFICULTY_LABEL[difficulty]}: not finished yet` : `${DIFFICULTY_LABEL[difficulty]}: finished, best time ${formatTime(seconds)}`,
          );
          return mark;
        }),
      );
    }
  }
}
