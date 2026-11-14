// When the game tells a player how to dive (src/ui/dive-hint.ts), and how it
// finds a passage that can only be passed underwater (passageNear in swim.ts).

import { describe, expect, it } from 'vitest';
import { STEP } from '../src/game/hero';
import { passageNear } from '../src/game/swim';
import { buildSandbox } from '../src/levels/sandbox/layout';
import { DiveHint, diveHintText, type DiveHintState } from '../src/ui/dive-hint';

const dry: DiveHintState = { swimming: false, under: false, entered: false, nearPassage: false };
const run = (hint: DiveHint, state: DiveHintState, seconds: number): number => {
  let shown = 0;
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) if (hint.step(state, STEP)) shown += 1;
  return shown;
};

describe('the dive hint', () => {
  it('shows the first time in a run the hero goes into the water, and not the next time', () => {
    const hint = new DiveHint();
    expect(hint.step({ ...dry, swimming: true, entered: true }, STEP)).toBe(true);
    expect(run(hint, { ...dry, swimming: true }, 2)).toBe(0);
    expect(hint.step({ ...dry, swimming: true, entered: true }, STEP)).toBe(false);
    hint.reset();
    expect(hint.step({ ...dry, swimming: true, entered: true }, STEP)).toBe(true);
  });

  it('shows again after a few seconds at the surface by an underwater-only passage, once for each stay', () => {
    const hint = new DiveHint(3);
    hint.step({ ...dry, swimming: true, entered: true }, STEP);
    const waiting = { ...dry, swimming: true, nearPassage: true };
    expect(run(hint, waiting, 2.9)).toBe(0);
    expect(run(hint, waiting, 0.2)).toBe(1);
    expect(run(hint, waiting, 10)).toBe(0);
    // Diving ends the stay; coming back up by it and waiting again shows it again.
    run(hint, { ...waiting, under: true }, 1);
    expect(run(hint, waiting, 3.1)).toBe(1);
    // Swimming away ends the stay too.
    run(hint, { ...waiting, nearPassage: false }, 1);
    expect(run(hint, waiting, 3.1)).toBe(1);
  });

  it('never shows on land, underwater, or at the surface away from a passage', () => {
    const hint = new DiveHint();
    hint.step({ ...dry, swimming: true, entered: true }, STEP);
    expect(run(hint, { ...dry, nearPassage: true }, 10)).toBe(0);
    expect(run(hint, { ...dry, swimming: true, under: true, nearPassage: true }, 10)).toBe(0);
    expect(run(hint, { ...dry, swimming: true }, 10)).toBe(0);
  });

  it('says the key on a keyboard, and the round button on touch', () => {
    expect(diveHintText(false)).toBe('Press X to dive');
    expect(diveHintText(true)).toMatch(/round button/);
  });
});

describe('finding an underwater-only passage', () => {
  const level = buildSandbox('normal');
  const pool = level.water![0];
  const arch = level.solids.find((s) => s.id === 'pool-arch')!;

  it('finds the Sandbox arch from the surface just in front of it', () => {
    expect(passageNear(level.solids, pool, 0, arch.z + arch.halfZ + 0.5)).toBe(true);
  });

  it('does not count the banks either side of the pool, nor open water', () => {
    const bank = level.solids.find((s) => s.id === 'bank-1')!;
    expect(passageNear(level.solids, pool, 0, bank.z - bank.halfZ - 0.5)).toBe(false);
    expect(passageNear(level.solids, pool, 0, pool.maxZ - 3)).toBe(false);
  });
});
