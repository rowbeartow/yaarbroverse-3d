// COCOLALLA LAKE: every Easy, Normal and Hard number for this level.
//
// This is the only file to change when the lake is too easy or too hard.
// Sizes and distances are in metres, times in seconds. For scale: a hero is
// about 0.8 m wide, a running jump carries about 5 m on flat ground, a full
// jump rises about 2 m, a swimmer makes 3.6 m a second at the surface and 4.2
// underwater, and a hero climbs out onto anything up to 1.35 m above the water.
//
// After changing a number, run `npm test`. The tests play the whole lake on
// all three difficulties as each hero and fail if a change makes it impossible.

import type { JumpAssist } from '../../game/assist';
import type { Difficulty } from '../../game/difficulty';
import type { FishingNumbers, MonsterNumbers, Species, SpeciesNumbers } from '../../game/fishing';
import type { PikeNumbers } from '../../game/pike';

export interface LakeNumbers {
  /**
   * THE SHORE PATH (section 1): boulders in a line along the south shore,
   * from the pebble beach to a grassy point. A missed hop lands in the lake.
   *   boulderCount    how many on the shore path.
   *   boulderRadius   how big each top is, from its middle to its edge.
   *   boulderGap      the open water between one and the next, and either end.
   */
  boulderCount: number;
  boulderRadius: number;
  boulderGap: number;
  /**
   * THE CROCODILE CROSSING (section 2): how far it is up the east channel
   * from the grassy point to the rock island. The long swim of section 5
   * comes back the same distance, so this also sets how long that is.
   */
  crossing: number;
  /**
   * The crocodiles a hero crosses on (section 2), in two rows with a rock
   * between. A row lies under the water until a hero comes near its first
   * crocodile; then they surface one after another along it, each with a
   * splash, so a wave runs up the row.
   *   stoneGap      about how much open water lies between one back and the
   *                 next. With `crossing`, it sets how many crocodiles there are.
   *   stoneStagger  seconds between one crocodile surfacing and the next.
   *   stoneUp       seconds each stays up, from the start of its rise.
   *   stonePeriod   seconds from one surfacing to its next: the row's rhythm.
   *                 Left out, the wave runs once and they stay up, so timing
   *                 does not matter (the owner's rule for Easy).
   *   stoneTell     how long before going under it shudders and growls: its warning.
   *   stoneSnap     seconds a hero can stand on one before it turns and snaps,
   *                 which costs a heart (the owner's rule for Hard). Left out: never.
   *   stoneWait     true: each row's first crocodile comes up and stays up until
   *                 the hero steps onto it, and the rest of the wave runs from
   *                 that step, so a row always starts with a fair first jump
   *                 (the owner's rule for Normal, 2026-11-16).
   */
  stoneGap: number;
  stoneStagger: number;
  stoneUp: number;
  stonePeriod?: number;
  stoneTell: number;
  stoneSnap?: number;
  stoneWait: boolean;
  /**
   * THE SWINGING PINES (section 3): two rope swings across the cove, the
   * first to a rock stack, the second up to the headland's ledge.
   *   ropeHelp      true: letting go at any point in a swing lands the hero
   *                 on the stack or the ledge (the owner's rule for Easy).
   *   stackRadius   how big the rock stack's top is. Smaller needs a better-timed let-go.
   *   ledgeAhead    how far past the second rope the ledge's edge is. Further
   *                 means letting go nearer the top of the swing.
   */
  ropeHelp: boolean;
  stackRadius: number;
  ledgeAhead: number;
  /**
   * THE SUNKEN LOGS (section 4): logs and boulders in turn, from the headland
   * to the gravel bar, with a zigzag of three boulders after the second log.
   * The bar is too high to climb onto from the water, so a missed jump means
   * swimming back to a log and going on from there.
   *   logCount    how many logs (three at least).
   *   logWidth    how wide each log is. Wider is easier to stay on.
   *   logGap      the open water between one piece and the next, and before the bar.
   */
  logCount: number;
  logWidth: number;
  logGap: number;
  /**
   * The logs sink (a `sink` piece, see src/game/moving.ts). The boulders between them never do: they are where to stop.
   *   logSinks   true: a log goes under `logTell` seconds after a hero lands on it, and comes back
   *              up `logBack` seconds later. False (Easy): it only bobs under the hero, and holds.
   */
  logSinks: boolean;
  logTell: number;
  logBack: number;
  /** THE ROCK TUNNEL (section 6): how long the way under the rocky point is. The only way on is to dive through it. */
  tunnelLength: number;
  /**
   * How far a side pocket runs off the tunnel's south wall, underwater, with a hidden leaf at its end.
   * 0 (Easy): no pocket, and the leaf hangs low at the side of the tunnel itself.
   */
  tunnelPocket: number;
  /**
   * The tipping log off the Sunken Logs' zigzag, with a hidden leaf over its far end (see moving.ts):
   * how long it creaks before it tips, and how far its end sinks under a hero.
   */
  leafLogTell: number;
  leafLogDip: number;
  /**
   * CATTAIL COVE and THE OLD PIER (sections 7 and 8): posts that climb out of
   * the water to the pier's landing; the boardwalk runs from there out to the
   * fishing dock. The low posts can be climbed onto from the water; the
   * landing, the boardwalk and the dock cannot.
   *   postCount    how many.
   *   postRadius   how big each top is.
   *   postGap      the open water between one and the next, and before the landing.
   *   postRise     how much higher each is than the one before, and the landing than the last.
   */
  postCount: number;
  postRadius: number;
  postGap: number;
  postRise: number;
  /** The old posts sink the same way as the logs: `postSinks`, `postTell` seconds after a hero lands, back up `postBack` seconds later. */
  postSinks: boolean;
  postTell: number;
  postBack: number;
  /**
   * THE CROCODILES, in the long swim (The Open Water, section 5). The
   * owner's rules: on Easy every one can be avoided without diving or precise
   * timing, and Normal and Hard make them a real threat.
   *   crocCount    how many, in the open water.
   *   crocAside    how far to the side of the way down the lake each waits
   *                (they take turns, west then east). On Easy far enough that
   *                a hero swimming straight down never comes into its water.
   *   crocHunt     true: it hunts. Its water is the whole of the open water,
   *                so it comes after a swimmer from the moment they are in,
   *                wherever they swim, and takes up the hunt again after
   *                every lunge (the owner's rule for Normal and Hard).
   *   crocLead     hunting: how many seconds ahead of the swimmer it aims its
   *                chase, to cut them off. 0 swims straight at them.
   *   crocPatch    not hunting: how far either side of where it waits its
   *                water reaches. Only a hero in that water is stalked.
   *   crocSpeed    how fast it swims after a hero. A hero swims 3.6 at the surface.
   *   crocReach    how far its lunge carries.
   *   crocWarning  times how long its tell lasts (0.9 s): its eyes sinking and the wake.
   *   crocRest     times how long it rests after a lunge (1.6 s): the opening to get past.
   *   crocHits     strikes that beat it.
   *   crocLine     whether a line shows where it will lunge, through its tell. Easy only, as with every enemy.
   */
  crocCount: number;
  /**
   * THE OPEN WATER (section 5), rebuilt in milestone ten so the long swim is more than holding one direction.
   *   boomGap         two log booms lie across the swim, each with one gap this wide, the first at the east end
   *                   and the second at the west. Round through the gap, or dive under the boom anywhere.
   *   restRock        a low rock half way to climb onto: 'checkpoint' (a fall comes back to it), 'rock', or 'none'.
   *   openMosquitoes  giant mosquitoes over the swim. They dive at a swimmer at the surface; underwater nothing reaches but a crocodile.
   * Two beds of weed lie on the straight line on every difficulty: a swimmer at the surface in one is slowed.
   */
  boomGap: number;
  restRock: 'checkpoint' | 'rock' | 'none';
  openMosquitoes: number;
  /**
   * THE LAND AND AIR ENEMIES, which behave as they do in the grove. Each waits on a wide, flat
   * place and never over a jump, a swing or a piece that sinks, so hazards do not stack.
   *   pointScout      true: a marmot scout on the grassy point at the end of the Shore Path.
   *   dockScouts      how many marmot scouts wait on the fishing dock, before the golden leaf.
   *   barMosquito     true: a giant mosquito over the gravel bar at the end of the Sunken Logs.
   *   scoutPatrol     how fast a scout walks its beat in plain view. 0: it hides where it is until a hero comes (Easy).
   *   scoutChase      how fast a scout comes after a hero on its ground. 0: it only throws. A hero runs at 6.
   *   scoutHealth     strikes that beat a scout.
   *   mosquitoFollow  how fast the mosquito keeps up with a hero under it.
   *   mosquitoPause   times how long it gets ready before a dive and rests after one. Smaller: it dives more often.
   */
  /**
   * FISHING, from the jetty off the fishing dock (see src/game/fishing.ts for what each number does).
   * Easy needs no timing: the cast lands beside the nearest fish, a fish hooks itself, and the line cannot snap.
   */
  fishing: FishingNumbers;
  /**
   * THE MONSTER PIKE (see src/game/pike.ts), hooked from the jetty and then fought in the water.
   * `monster` is the tug of war on the line (where its circle is comes from the lake's layout):
   *   cruise   how fast its shadow swims its circle. A lure has to land near it.
   *   pips     how many of its pips the tug of war takes: one for each stretch of line reeled in.
   *   dragAt   metres of line still out when the last of those goes and it drags the hero into the lake.
   *   calm     seconds it tires for between thrashes: reel now.
   *   thrash   seconds a thrash lasts (it lasts 1.4 times this): let the line run, or it snaps (`snap` in `fishing`).
   *   run      how fast it takes line back while it thrashes.
   *   pull     with cast help (Easy), how strongly the cast is drawn to it: a ring anywhere about it hooks it.
   * `pike` is the water half:
   *   health         pips in all: the tug of war's, and the rest to be struck off from the floating log.
   *   swimSpeed      how fast it circles.
   *   pause          seconds it circles between attacks.
   *   chargeWarning  seconds of tell before it rushes a swimmer. Swim out of its line.
   *   chargeSpeed    how fast the rush is (a swimmer makes 3.6), and `chargeReach` how far it goes.
   *   snapWarning    seconds it shows its open jaws off the end of the log before it throws itself up it. Run down the log.
   *   rest           seconds it then lies spent with its head on the log: the opening.
   *   aimLine        true: lines show where a rush and a snap will go (Easy only, the owner's rule).
   * Easy needs no timing: the line cannot snap, the tells are long, and it lies spent for a long time.
   */
  monster: Omit<MonsterNumbers, 'home' | 'circle' | 'size'>;
  pike: PikeNumbers;
  pointScout: boolean;
  dockScouts: number;
  barMosquito: boolean;
  scoutPatrol: number;
  scoutChase: number;
  scoutHealth: number;
  mosquitoFollow: number;
  mosquitoPause: number;
  /** True: one more crocodile waits under the sunken logs (section 4), for anyone who falls in or goes down with a log. Normal and Hard. */
  crocUnderLogs: boolean;
  crocHunt: boolean;
  crocLead: number;
  crocAside: number;
  crocPatch: number;
  crocSpeed: number;
  crocReach: number;
  crocWarning: number;
  crocRest: number;
  crocHits: number;
  crocLine: boolean;
  /** Which banks are checkpoints, counted along the route: 1 the grassy point, 2 the rock island, 3 the headland, 4 the gravel bar, 5 the reed bar, 6 the cove's beach. The beach always is. */
  checkpoints: number[];
  /** Seconds a hero can stay underwater. Left out, breath never runs out (Easy, by the owner's rule). */
  breath?: number;
  /** Hearts a hero starts with. */
  hearts: number;
  /** Times how long a hero is protected after being hurt. */
  protection: number;
  /** How far a hit throws a hero. */
  knockback: number;
  /** After walking off an edge, Jump still works for this long. */
  coyoteTime: number;
  /** Feet this far below a ledge still get lifted onto it. */
  ledgeHelp: number;
  /**
   * The jump assist (src/game/assist.ts): a jump aimed roughly at a small
   * piece or a rope steers onto it, for a keyboard's eight directions.
   *   reach   how far from where the jump would come down it can be, in metres.
   *   angle   how far off the way the stick points, in degrees.
   * Left out, none (Hard, by the owner's rule).
   */
  jumpAssist?: JumpAssist;
}

/**
 * The four fish of Cocolalla (the owner's word, 2026-11-19), each in its own
 * water and with its own way of biting and fighting. `zone` is metres out
 * from the jetty; `size` is centimetres (game numbers, not canon).
 *   perch   the shallows by the jetty. One nibble, then a bite; one short thrash.
 *   bass    the middle water. Bold: often no nibble at all. Short, heavy thrashes.
 *   trout   the middle water, further out. Shy: it nibbles first. Long runs.
 *   pike    the deep water, one at a time. No nibble. Thrashes come fast.
 * `more` is how many more nibbles each fish that nibbles at all gives on a difficulty.
 */
const FISH: Record<Species, SpeciesNumbers> = {
  perch: { count: 3, zone: [4, 9], size: [12, 30], nibbles: [1, 1], calm: 2.2, thrash: 0.7, run: 1.2 },
  bass: { count: 2, zone: [9, 14], size: [25, 55], nibbles: [0, 1], calm: 1.9, thrash: 1.0, run: 2.0 },
  trout: { count: 2, zone: [13, 19], size: [30, 70], nibbles: [1, 2], calm: 1.6, thrash: 1.5, run: 3.0 },
  pike: { count: 1, zone: [19, 23], size: [50, 110], nibbles: [0, 0], calm: 1.4, thrash: 1.3, run: 3.4 },
};

export const LAKE_DIFFICULTY: Record<Difficulty, LakeNumbers> = {
  easy: {
    fishing: { castHelp: true, sweep: 5, notice: 3, spook: 0, biteWindow: Infinity, moreNibbles: 0, nibbleScares: false, snap: Infinity, tell: 1, drift: 0, reel: 3.2, species: FISH },
    monster: { cruise: 1.6, pips: 2, dragAt: 4, calm: 2.5, thrash: 0.9, run: 0, pull: 3 },
    pike: { health: 4, swimSpeed: 2.2, pause: 3, chargeWarning: 2.2, chargeSpeed: 6, chargeReach: 8, snapWarning: 2.4, rest: 5, aimLine: true },
    boulderCount: 5, boulderRadius: 1.6, boulderGap: 0.9,
    crossing: 34,
    stoneGap: 1.3, stoneStagger: 0.3, stoneUp: 4, stoneTell: 0, stoneWait: false,
    ropeHelp: true, stackRadius: 3.4, ledgeAhead: 3.2,
    logCount: 3, logWidth: 2.4, logGap: 1, logSinks: false, logTell: 0.6, logBack: 0,
    tunnelLength: 4, tunnelPocket: 0, leafLogTell: 0.8, leafLogDip: 0.2,
    postCount: 4, postRadius: 1, postGap: 0.9, postRise: 0.5, postSinks: false, postTell: 0.6, postBack: 0,
    crocCount: 2, crocUnderLogs: false, crocHunt: false, crocLead: 0, crocAside: 9, crocPatch: 4, crocSpeed: 1.5, crocReach: 3.5, crocWarning: 2, crocRest: 1.6, crocHits: 1, crocLine: true,
    boomGap: 8, restRock: 'checkpoint', openMosquitoes: 0,
    pointScout: false, dockScouts: 1, barMosquito: false, scoutPatrol: 0, scoutChase: 0, scoutHealth: 1, mosquitoFollow: 3, mosquitoPause: 1,
    checkpoints: [1, 2, 3, 4, 5, 6],
    hearts: 5, protection: 1.5, knockback: 0.5, coyoteTime: 0.2, ledgeHelp: 0.5,
    jumpAssist: { reach: 1.6, angle: 35 },
  },
  normal: {
    fishing: { castHelp: false, sweep: 7, notice: 2.5, spook: 0, biteWindow: 1.5, moreNibbles: 0, nibbleScares: false, snap: 1.5, tell: 0.7, drift: 0.3, reel: 3, species: FISH },
    monster: { cruise: 2.2, pips: 3, dragAt: 4, calm: 2, thrash: 1, run: 2, pull: 1 },
    pike: { health: 6, swimSpeed: 3, pause: 2.2, chargeWarning: 1.1, chargeSpeed: 10, chargeReach: 10, snapWarning: 1.2, rest: 2.8, aimLine: false },
    boulderCount: 6, boulderRadius: 1.2, boulderGap: 1.8,
    crossing: 48,
    stoneGap: 1.9, stoneStagger: 1.4, stoneUp: 4, stonePeriod: 8, stoneTell: 0.8, stoneWait: true,
    ropeHelp: false, stackRadius: 3, ledgeAhead: 3.6,
    logCount: 3, logWidth: 1.6, logGap: 2, logSinks: true, logTell: 1.2, logBack: 2.5,
    tunnelLength: 6, tunnelPocket: 2.6, leafLogTell: 0.45, leafLogDip: 0.7,
    postCount: 5, postRadius: 0.75, postGap: 1.6, postRise: 0.6, postSinks: true, postTell: 1.5, postBack: 2.5,
    crocCount: 3, crocUnderLogs: true, crocHunt: true, crocLead: 0.6, crocAside: 4, crocPatch: 9, crocSpeed: 2.9, crocReach: 4.5, crocWarning: 1, crocRest: 1, crocHits: 1, crocLine: false,
    boomGap: 5, restRock: 'rock', openMosquitoes: 1,
    pointScout: true, dockScouts: 1, barMosquito: true, scoutPatrol: 1.6, scoutChase: 2.6, scoutHealth: 1, mosquitoFollow: 5, mosquitoPause: 0.6,
    checkpoints: [1, 2, 3, 4, 5, 6],
    breath: 16,
    hearts: 3, protection: 1, knockback: 1.2, coyoteTime: 0.12, ledgeHelp: 0.3,
    jumpAssist: { reach: 1, angle: 25 },
  },
  hard: {
    fishing: { castHelp: false, sweep: 10, notice: 1.2, spook: 0.5, biteWindow: 0.7, moreNibbles: 1, nibbleScares: true, snap: 0.8, tell: 0.4, drift: 0.8, reel: 2.8, species: FISH },
    monster: { cruise: 3, pips: 4, dragAt: 4, calm: 1.5, thrash: 1, run: 2.2, pull: 1 },
    pike: { health: 8, swimSpeed: 3.6, pause: 1.5, chargeWarning: 0.7, chargeSpeed: 13, chargeReach: 12, snapWarning: 0.75, rest: 1.8, aimLine: false },
    boulderCount: 7, boulderRadius: 0.85, boulderGap: 2.6,
    crossing: 54,
    stoneGap: 2.2, stoneStagger: 0.95, stoneUp: 2.1, stonePeriod: 5, stoneTell: 0.5, stoneSnap: 0.8, stoneWait: false,
    ropeHelp: false, stackRadius: 2.2, ledgeAhead: 4.2,
    logCount: 4, logWidth: 1, logGap: 2.8, logSinks: true, logTell: 0.7, logBack: 2.5,
    tunnelLength: 9, tunnelPocket: 4.6, leafLogTell: 0.3, leafLogDip: 1.1,
    postCount: 6, postRadius: 0.55, postGap: 2.3, postRise: 0.6, postSinks: true, postTell: 0.9, postBack: 2.5,
    crocCount: 5, crocUnderLogs: true, crocHunt: true, crocLead: 1.2, crocAside: 5, crocPatch: 10, crocSpeed: 3.3, crocReach: 5.5, crocWarning: 0.7, crocRest: 0.75, crocHits: 2, crocLine: false,
    boomGap: 4, restRock: 'none', openMosquitoes: 2,
    pointScout: true, dockScouts: 2, barMosquito: true, scoutPatrol: 2.2, scoutChase: 4.6, scoutHealth: 2, mosquitoFollow: 6.5, mosquitoPause: 0.45,
    checkpoints: [2, 4, 6],
    breath: 11,
    hearts: 2, protection: 0.6, knockback: 2, coyoteTime: 0.06, ledgeHelp: 0.15,
  },
};

export const LAKE_BLURB: Record<Difficulty, string> = {
  easy: 'Big boulders, short swims, all the breath you need',
  normal: 'The lake as it comes',
  hard: 'Narrow logs, long swims, a long dive',
};
