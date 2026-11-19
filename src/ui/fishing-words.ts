// What the game says while fishing, and what the round button is called at
// each moment. No browser code, so the tests read it.

import type { FishingEvent, FishingPhase, Species } from '../game/fishing';

export const SPECIES_NAME: Record<Species, string> = { perch: 'Perch', bass: 'Bass', trout: 'Trout', pike: 'Pike' };

/** What the round button does now: its label, or null when it is the hero's own move. */
export const fishingButton = (onSpot: boolean, phase: FishingPhase): string | null => {
  if (phase === 'aim') return 'Cast';
  if (phase === 'cast' || phase === 'wait') return 'Wait';
  if (phase === 'bite') return 'Hook!';
  if (phase === 'hooked') return 'Reel';
  if (phase === 'show' || phase === 'lost') return 'Fish';
  return onSpot ? 'Fish' : null;
};

/** The hint on stepping onto the spot. */
export const fishingHint = (touch: boolean): string =>
  touch ? 'Hold the round button to fish. Let go to cast.' : 'Hold X to fish. Let go to cast.';

/** `easy` is true where a fish hooks itself and the line cannot snap. Returns the words and how long they show, or null. */
export const fishingNews = (event: FishingEvent, touch: boolean, easy: boolean): { text: string; seconds: number } | null => {
  const button = touch ? 'the round button' : 'X';
  switch (event.what) {
    case 'start':
      return { text: `Let go to cast where the gold ring is. ${touch ? 'Your left thumb' : 'The arrow keys'} move it.`, seconds: 4 };
    case 'plop':
      return { text: 'Wait for a bite. Jump winds the line in.', seconds: 3 };
    case 'bite':
      return { text: easy ? `A bite! Hold ${button} to reel it in.` : `A bite! Press ${button} now!`, seconds: 2.5 };
    case 'hooked':
      return { text: easy ? `Hooked! Hold ${button} to reel.` : `Hooked! Hold ${button} to reel. Let go when it thrashes.`, seconds: 3.5 };
    case 'thrash':
      return easy ? null : { text: 'It is thrashing! Let the line run.', seconds: 1.5 };
    case 'calm':
      return easy ? null : { text: 'It is tiring. Reel!', seconds: 1.5 };
    case 'missed':
      return { text: 'Too slow. It swam off.', seconds: 2.5 };
    case 'scared':
      return { text: 'You scared it off.', seconds: 2.5 };
    case 'snapped':
      return { text: 'Snap! The line broke and it got away.', seconds: 3 };
    case 'away':
      return { text: 'It took all the line and got away.', seconds: 3 };
    case 'landed':
      return { text: `${SPECIES_NAME[event.species]}! ${event.size} cm.`, seconds: 3.5 };
    default:
      return null;
  }
};
