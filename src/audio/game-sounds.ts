// Turns what the rules report into sounds. No browser code: the rule tests
// run it against a stand-in speaker.
//
// Three kinds of thing make sound:
//   - events from a step of the game (a jump, a hit, an enemy's warning)
//   - footsteps, counted from how far the hero has walked, and strokes, from how far it has swum
//   - sounds that last (Yaarbro's roll, the mosquito's whine), set every step
// And underwater the whole mix is muffled, for as long as the hero's head is under.

import type { Enemy } from '../game/enemy';
import type { Game, GameEvent } from '../game/game';
import { MOVE, STEP } from '../game/hero';
import type { SolidKind } from '../game/level';
import type { Sound } from './mix';
import type { SoundName } from './sounds';

/** Metres within which an enemy is heard at full loudness. */
export const NEAR = 6;
/** Metres past which an enemy is not heard at all. A tell carries well past the edge of the screen. */
export const FAR = 48;

/**
 * How loud something sounds from this many metres away, from 1 (close) to 0
 * (out of earshot). It falls off quickly at first and then slowly, the way
 * real sound does, so a far-off warning is quiet but still there.
 */
export const byDistance = (metres: number): number => {
  if (metres <= NEAR) return 1;
  if (metres >= FAR) return 0;
  const falling = NEAR / metres;
  // Eases to nothing over the last stretch, so a sound never cuts off at the edge.
  const edge = Math.min(1, (FAR - metres) / 12);
  return falling ** 0.8 * edge;
};

/** Metres within which a windy bough's gust is heard. Two boughs taking turns gust often, so far-off ones stay quiet. */
const GUST_NEAR = 18;

const STEP_SOUND: Record<SolidKind, SoundName> = {
  bank: 'stepMoss',
  log: 'stepWood',
  stump: 'stepWood',
  shelf: 'stepWood',
  bough: 'stepWood',
  mushroom: 'stepMushroom',
  moss: 'stepMoss',
  arch: 'stepMoss',
};

/** Metres between footsteps. Caputo has four paws and a shorter step. */
const STRIDE = { Yaarbro: 1.25, Caputo: 0.8 } as const;

/** Metres swum at the surface between strokes. Caputo's paddle is quicker. */
export const STROKE = { Yaarbro: 1.4, Caputo: 0.9 } as const;

/** How loud going into the water is, from how fast the hero was dropping: a step in is soft, a drop from high up is full. */
export const splashVolume = (speed: number): number => 0.45 + 0.55 * Math.min(1, speed / 12);

const distanceTo = (game: Game, enemy: Enemy): number => Math.hypot(enemy.x - game.x, enemy.y - game.y, enemy.z - game.z);

export class GameSounds {
  private walked = 0;
  /** What the hero last stood on: a jump pushes off from it. */
  private underfoot: SolidKind = 'bank';

  constructor(private readonly sound: Sound) {}

  /** A new run: forget how far the last hero had walked, and quiet anything that lasts. */
  reset(): void {
    this.walked = 0;
    this.underfoot = 'bank';
    this.sound.stopLoops();
    this.sound.endTune();
    this.sound.setUnderwater(false);
  }

  private kindOf(game: Game): SolidKind | null {
    if (game.groundId === null) return null;
    return game.level.solids.find((solid) => solid.id === game.groundId)?.kind ?? null;
  }

  /** Call once after every step of the game. */
  step(game: Game): void {
    this.events(game, game.events);
    this.underfoot = this.kindOf(game) ?? this.underfoot;
    this.footsteps(game);
    this.lasting(game);
  }

  private events(game: Game, events: GameEvent[]): void {
    const { sound } = this;
    const voice = game.hero === 'Caputo' ? 'caputo' : 'yaarbro';
    for (const event of events) {
      if (event.type === 'jump') {
        // A quiet push-off from whatever the hero was standing on. There is no jump sound of its own.
        sound.play(this.underfoot === 'bank' || this.underfoot === 'moss' ? 'pushMoss' : 'pushWood', { voice });
      } else if (event.type === 'land') {
        // A landing sounds like the surface: two soft footsteps with a low thump under them.
        sound.play(this.kindOf(game) === 'bank' || this.kindOf(game) === 'moss' ? 'landMoss' : 'landWood', { voice });
        // The landing is the step: the next footstep is a full stride away.
        this.walked = 0;
      } else if (event.type === 'bounce') sound.play('bounce');
      else if (event.type === 'pounce') sound.play('pounce');
      else if (event.type === 'fall') sound.play('fall');
      else if (event.type === 'splash') {
        sound.play('waterIn', { volume: splashVolume(event.speed) });
        this.walked = 0;
      } else if (event.type === 'surface') sound.play('surfacing');
      // Out of breath sounds like running out of hearts: it is the same setback.
      else if (event.type === 'breathless') sound.play('heartsOut');
      else if (event.type === 'hurt') sound.play(event.left > 0 ? 'hit' : 'heartsOut');
      else if (event.type === 'safe') sound.play('checkpoint');
      else if (event.type === 'strike') sound.play('strike');
      else if (event.type === 'goal') sound.playTune('leafTune');
      else if (event.type === 'boss') {
        // A boss is loud enough to be heard across its arena: no fading with distance.
        // Its warnings, throws and hits are the scout's sounds played lower, so it sounds its size.
        const big = { voice: 'chief' } as const;
        if (event.what === 'hit') sound.play('strike', big);
        else if (event.what === 'blocked') sound.play('bounce');
        else if (event.what === 'beaten') sound.play('bossBeaten');
        else if (event.what === 'phase' && event.phase === 'warning') sound.play('marmotTell', big);
        else if (event.what === 'phase' && event.phase === 'attack' && event.attack === 'throw') sound.play('marmotThrow', big);
        else if (event.what === 'phase' && event.phase === 'attack' && event.attack === 'charge') sound.play('pounce');
        else if (event.what === 'phase' && (event.phase === 'intro' || event.phase === 'roar')) sound.play('marmotTell', big);
      }
      else if (event.type === 'piece') {
        // A moving piece is heard from where it is, like an enemy.
        const piece = game.level.solids.find((solid) => solid.id === event.id);
        const volume = piece ? byDistance(Math.hypot(piece.x - game.x, piece.top - game.y, piece.z - game.z)) : 1;
        if (volume <= 0) continue;
        if (event.kind === 'tip' && event.what === 'tell') sound.play('creak', { volume });
        else if (event.kind === 'tip' && event.what === 'move') sound.play('creak', { volume: volume * 0.7 });
        else if (event.kind === 'crumble' && event.what === 'tell') sound.play('mossRustle', { volume });
        else if (event.kind === 'crumble' && event.what === 'fall') sound.play('mossFall', { volume });
        // Windy boughs gust over and over: only the ones close by are heard.
        else if (event.kind === 'sway' && event.what === 'tell' && piece && Math.hypot(piece.x - game.x, piece.z - game.z) < GUST_NEAR) sound.play('gust', { volume });
      }
      else if (event.type === 'enemy') {
        const enemy = game.enemies.find((candidate) => candidate.spot.id === event.id);
        const volume = enemy ? byDistance(distanceTo(game, enemy)) : 1;
        if (event.phase === 'warning') sound.play(event.kind === 'marmot' ? 'marmotTell' : 'mosquitoTell', { volume });
        else if (event.phase === 'attack') sound.play(event.kind === 'marmot' ? 'marmotThrow' : 'mosquitoDive', { volume });
      }
    }
  }

  private footsteps(game: Game): void {
    if (game.swimming) {
      this.strokes(game);
      return;
    }
    const walking = game.grounded && !game.rolling && game.groundId !== null && game.returning <= 0 && game.fainting <= 0;
    if (!walking) return;
    const speed = Math.hypot(game.vx, game.vz);
    // Creeping along makes no sound, and neither does standing still.
    if (speed < MOVE.walkSpeed * 0.12) return;
    this.walked += speed * STEP;
    if (this.walked < STRIDE[game.hero]) return;
    this.walked = 0;
    const under = game.level.solids.find((solid) => solid.id === game.groundId);
    if (!under) return;
    this.sound.play(STEP_SOUND[under.kind], {
      voice: game.hero === 'Caputo' ? 'caputo' : 'yaarbro',
      // A gentle walk is quieter than a run.
      volume: 0.55 + 0.45 * Math.min(1, speed / MOVE.walkSpeed),
    });
  }

  /** A stroke for each stretch swum at the surface. Underwater, strokes are not heard. */
  private strokes(game: Game): void {
    const speed = Math.hypot(game.vx, game.vz);
    if (game.under || speed < 0.5) return;
    this.walked += speed * STEP;
    if (this.walked < STROKE[game.hero]) return;
    this.walked = 0;
    this.sound.play('stroke', { voice: game.hero === 'Caputo' ? 'caputo' : 'yaarbro', volume: 0.6 + 0.4 * Math.min(1, speed / 3.6) });
  }

  private lasting(game: Game): void {
    // Underwater, everything is muffled.
    this.sound.setUnderwater(game.swimming && game.under);

    // The roll rumbles while he is tucked and on the ground, louder the faster he goes.
    const rolling = game.rolling && game.grounded;
    this.sound.setLoop('roll', rolling ? Math.min(1, 0.35 + 0.65 * (Math.hypot(game.vx, game.vz) / MOVE.rollSpeed)) : 0);

    // The mosquito's whine: the nearest one that is still about.
    let whine = 0;
    for (const enemy of game.enemies) {
      if (enemy.kind !== 'mosquito' || enemy.phase === 'defeated' || enemy.phase === 'concealed' || enemy.dormant) continue;
      whine = Math.max(whine, byDistance(distanceTo(game, enemy)));
    }
    // In steps of a twentieth, so the speaker is not told about every hair's breadth.
    this.sound.setLoop('mosquitoHover', Math.round(whine * 20) / 20);
  }
}
