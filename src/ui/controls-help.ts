// The controls, as the level card and the pause screen show them: one list
// for a keyboard and one for touch, with the hero's own move by name.
// `controlsFor` has no browser code, so the tests check it; `showControls`
// puts a list on the page.

import { MOVE_NAME, type HeroName } from '../game/hero';
import { ALLY_NAME } from '../game/sidekick';

export interface ControlRow {
  /** What the player does: the keys, or where to touch. */
  how: string;
  /** What it does in the game. */
  does: string;
}

/** What the second move does, in a few words. */
const ALLY_DOES: Record<HeroName, string> = { Yaarbro: 'Send Walblum to kick', Caputo: 'Claw Slash' };

/** The controls for a keyboard or for touch, for this hero. `ally` adds the second move, for a player who has it. */
export const controlsFor = (touch: boolean, hero: HeroName, ally = false): ControlRow[] => {
  const move = MOVE_NAME[hero];
  const rows: ControlRow[] = touch
    ? [
        { how: 'Drag on the left', does: 'Move' },
        { how: 'Tap the right', does: 'Jump (hold for higher)' },
        { how: 'Round button', does: move },
        { how: 'Round button in water', does: 'Dive' },
      ]
    : [
        { how: 'Arrows or W A S D', does: 'Move' },
        { how: 'Space', does: 'Jump (hold for higher)' },
        { how: 'X or Shift', does: move },
        { how: 'X or Shift in water', does: 'Dive' },
        { how: 'Esc', does: 'Pause' },
        { how: 'M', does: 'Sound off and on' },
      ];
  if (ally) rows.splice(3, 0, { how: touch ? `The ${ALLY_NAME[hero]} button` : 'C or Z', does: ALLY_DOES[hero] });
  return rows;
};

/** Fills `holder` with the controls, as a list of what to press and what it does. */
export const showControls = (holder: HTMLElement, touch: boolean, hero: HeroName, ally = false): void => {
  const key = `${touch}/${hero}/${ally}`;
  if (holder.dataset.shown === key) return;
  holder.dataset.shown = key;
  holder.dataset.input = touch ? 'touch' : 'keyboard';
  const list = document.createElement('dl');
  for (const row of controlsFor(touch, hero, ally)) {
    const how = document.createElement('dt');
    how.textContent = row.how;
    const does = document.createElement('dd');
    does.textContent = row.does;
    list.append(how, does);
  }
  holder.replaceChildren(list);
};
