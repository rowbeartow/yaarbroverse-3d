// The controls the level card and the pause screen show (src/ui/controls-help.ts).

import { describe, expect, it } from 'vitest';
import { controlsFor } from '../src/ui/controls-help';

describe('the controls shown before a run and on the pause screen', () => {
  it.each([false, true])('cover moving, jumping, the hero’s own move and diving, on %s touch', (touch) => {
    for (const hero of ['Yaarbro', 'Caputo'] as const) {
      const does = controlsFor(touch, hero).map((row) => row.does);
      expect(does).toContain('Move');
      expect(does.some((thing) => thing.startsWith('Jump'))).toBe(true);
      expect(does).toContain(hero === 'Yaarbro' ? 'Roll' : 'Pounce');
      expect(does).toContain('Dive');
    }
  });

  it('name the keys on a keyboard, with X or Shift for both the move and the dive', () => {
    const rows = controlsFor(false, 'Caputo');
    expect(rows.find((row) => row.does === 'Pounce')?.how).toBe('X or Shift');
    expect(rows.find((row) => row.does === 'Dive')?.how).toBe('X or Shift in water');
    expect(rows.find((row) => row.does === 'Move')?.how).toMatch(/Arrows/);
    expect(rows.find((row) => row.does === 'Pause')?.how).toBe('Esc');
  });

  it('name where to touch on touch: the round button for the move and the dive, and no keys', () => {
    const rows = controlsFor(true, 'Yaarbro');
    expect(rows.find((row) => row.does === 'Roll')?.how).toBe('Round button');
    expect(rows.find((row) => row.does === 'Dive')?.how).toBe('Round button in water');
    expect(rows.some((row) => /Space|Shift|Esc|Arrows/.test(row.how))).toBe(false);
  });
});
