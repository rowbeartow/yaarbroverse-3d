// THE SANDBOX: where everything is. A bank, two logs with a break between
// them, a bank, a mushroom, and a high bank with the golden leaf over it.
// About ten seconds for the bot. Development only: see difficulty.ts.

import type { Difficulty } from '../../game/difficulty';
import type { Level, Solid } from '../../game/level';
import { SANDBOX_DIFFICULTY, type SandboxNumbers } from './difficulty';

export const SANDBOX_NAME = 'The Sandbox';

export function buildSandbox(difficulty: Difficulty, numbers: SandboxNumbers = SANDBOX_DIFFICULTY[difficulty]): Level {
  const n = numbers;
  const solids: Solid[] = [];
  // `from` and `to` count metres travelled away from the camera, which is -z in the world.
  const box = (id: string, kind: Solid['kind'], from: number, to: number, halfX: number, top: number, bottom: number, extra: Partial<Solid> = {}): void => {
    solids.push({ id, kind, shape: 'box', x: 0, z: -(from + to) / 2, halfX, halfZ: (to - from) / 2, top, bottom, ...extra });
  };

  box('bank-start', 'bank', -4, 4, 3.5, 0, -40, { safe: true });
  let at = 4;
  box('log-1', 'log', at, at + 5, n.logWidth / 2, 0, -1);
  at += 5 + n.logGap;
  box('log-2', 'log', at, at + 5, n.logWidth / 2, 0, -1);
  at += 5;
  box('bank-1', 'bank', at, at + 6, 3.5, 0, -40, { safe: true });
  at += 6;
  // A mushroom growing from just below the bank's height bounces the hero up to the last bank.
  at += 0.6 + n.mushroomRadius;
  solids.push({ id: 'mushroom-1', kind: 'mushroom', shape: 'round', x: 0, z: -at, halfX: n.mushroomRadius, halfZ: n.mushroomRadius, top: 1, bottom: -40, bounce: 15 });
  at += n.mushroomRadius + 0.6;
  const top = 3.4;
  box('bank-end', 'bank', at, at + 7, 3.5, top, -40, { safe: true });

  return {
    name: SANDBOX_NAME,
    solids,
    spawn: { x: 0, y: 0, z: 0 },
    leaf: { x: 0, y: top + 1.3, z: -(at + 5), radius: 0.7 },
    fallY: -6,
    coyoteTime: n.coyoteTime,
    ledgeHelp: n.ledgeHelp,
    hearts: n.hearts,
    protection: n.protection,
    knockback: n.knockback,
    route: solids.map((s) => s.id),
    sections: [{ name: 'The Sandbox', solids: solids.map((s) => s.id) }],
    hints: { 'bank-1': 'Jump onto the mushroom and bounce up high.' },
    goalLine: 'The golden leaf!',
  };
}
