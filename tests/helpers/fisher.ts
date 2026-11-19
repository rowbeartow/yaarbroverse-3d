// A bot that fishes, for the rule tests: it reads the fishing spot as it is
// and presses what a player would. It goes after one kind of fish: it holds
// the button until the ring is over one, lets go, hooks the bite, reels while
// the fish tires and lets the line run while it thrashes.

import { IDLE, type Game, type Input } from '../../src/game/game';
import type { Species } from '../../src/game/fishing';
import { STEP } from '../../src/game/hero';

export class Fisher {
  /** Seconds the line has waited with no fish coming. */
  private idle = 0;
  /** Presses must be fresh: the button was up on the step before. */
  private up = true;

  constructor(private readonly want: Species) {}

  input(game: Game): Input {
    const state = game.fishing!;
    const spot = game.level.fishing!;
    const press = (): Input => {
      const move = this.up;
      this.up = !move;
      return { ...IDLE, move };
    };
    const hold = (extra: Partial<Input> = {}): Input => {
      this.up = false;
      return { ...IDLE, move: true, ...extra };
    };
    const rest = (extra: Partial<Input> = {}): Input => {
      this.up = true;
      return { ...IDLE, ...extra };
    };
    switch (state.phase) {
      case 'off':
        this.idle = 0;
        return press();
      case 'aim': {
        const target = state.fish.find((fish) => fish.species === this.want && fish.mood === 'idle');
        if (!target) return hold();
        const side = target.across - state.across;
        // The stick is in the level's own directions: turn "to the right of ahead" back into them.
        const stick = Math.abs(side) > 0.15 ? Math.sign(side) : 0;
        const steer = { moveX: -spot.ahead.z * stick, moveZ: spot.ahead.x * stick };
        const near = Math.abs(state.out - (target.out - 0.3)) <= spot.numbers.sweep * STEP && Math.abs(side) < 0.4;
        return near ? rest() : hold(steer);
      }
      case 'wait': {
        const taker = state.fish.find((fish) => fish.id === state.taker);
        this.idle = taker ? 0 : this.idle + STEP;
        // Nothing is coming, or the wrong fish is: wind in and cast again.
        if (this.idle > 1.5 || (taker && taker.species !== this.want)) return rest({ jump: true });
        return rest();
      }
      case 'bite':
        return press();
      case 'hooked':
        return state.fight === 'thrash' ? rest() : hold();
      default:
        return rest();
    }
  }
}

/** Fishes until a fish of the wanted kind is landed, or the seconds run out. Returns its size, or null. */
export const catchOne = (game: Game, want: Species, seconds = 240): number | null => {
  const fisher = new Fisher(want);
  const before = game.catches.length;
  for (let i = 0; i < seconds / STEP; i += 1) {
    game.step(fisher.input(game));
    const landed = game.catches.slice(before).find((each) => each.species === want);
    if (landed) return landed.size;
  }
  return null;
};
