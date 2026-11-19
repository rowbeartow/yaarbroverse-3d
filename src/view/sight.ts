// Which enemies are drawn this frame. A skeleton moves every point of its
// model on every frame, so an enemy too far off to matter is neither moved
// nor drawn, and a level whose frame budget is tight (Cocolalla Lake) also
// draws only the nearest few. No 3D code: tests/sight.test.ts holds it.

/** Without a level's own numbers: enemies further along the route than this are in the mist. */
export const SEEN_WITHIN = 70;

export interface Sight {
  /** Metres from the hero, measured flat, beyond which an enemy is not drawn. */
  within: number;
  /** The most enemies drawn at once: the nearest. */
  most: number;
}

interface Spot {
  x: number;
  z: number;
}

/**
 * True for each enemy that is drawn. `busy` marks an enemy that must be drawn
 * whatever the count, because it is doing something a player has to see: its
 * warning or its attack.
 */
export const enemiesInSight = (enemies: readonly Spot[], hero: Spot, sight: Sight | undefined, busy: readonly boolean[] = []): boolean[] => {
  // The forest's old rule: only how far along the route counts, since it runs one way.
  if (!sight) return enemies.map((enemy) => Math.abs(enemy.z - hero.z) < SEEN_WITHIN);
  const far = enemies.map((enemy) => Math.hypot(enemy.x - hero.x, enemy.z - hero.z));
  const nearest = far
    .map((distance, index) => ({ distance, index }))
    .filter((each) => each.distance < sight.within)
    .sort((a, b) => a.distance - b.distance || a.index - b.index);
  const seen = enemies.map(() => false);
  nearest.slice(0, sight.most).forEach((each) => (seen[each.index] = true));
  nearest.forEach((each) => {
    if (busy[each.index]) seen[each.index] = true;
  });
  return seen;
};
