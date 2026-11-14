// When to tell a player how to dive. No browser code, so the tests run it.
//
// The hint shows the first time in a run that the hero goes into the water,
// and again whenever a swimmer sits at the surface in front of a passage it
// can only get through underwater (see `passageNear` in src/game/swim.ts) for
// `wait` seconds. It shows once for each such stay: the swimmer has to dive,
// leave, or get out of the water before it can show again.

export interface DiveHintState {
  /** In deep water, and with the head under. */
  swimming: boolean;
  under: boolean;
  /** The hero went into the water during this step. */
  entered: boolean;
  /** An underwater-only passage is close by. */
  nearPassage: boolean;
}

export class DiveHint {
  private shownThisRun = false;
  private stayed = 0;
  private shownForStay = false;

  constructor(private readonly wait = 3) {}

  /** A new run: the first time in the water shows the hint again. */
  reset(): void {
    this.shownThisRun = false;
    this.stayed = 0;
    this.shownForStay = false;
  }

  /** Call once a rules step. True when the hint should show now. */
  step(state: DiveHintState, dt: number): boolean {
    if (state.entered && !this.shownThisRun) {
      this.shownThisRun = true;
      return true;
    }
    const waiting = state.swimming && !state.under && state.nearPassage;
    if (!waiting) {
      this.stayed = 0;
      this.shownForStay = false;
      return false;
    }
    this.stayed += dt;
    if (this.stayed >= this.wait && !this.shownForStay) {
      this.shownForStay = true;
      return true;
    }
    return false;
  }
}

/** The words of the hint: on a keyboard, the key; on touch, the round button, which pulses with a dive mark. */
export const diveHintText = (touch: boolean): string => (touch ? 'Tap the round button to dive' : 'Press X to dive');
