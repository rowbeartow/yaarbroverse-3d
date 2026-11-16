// The test bot with a keyboard: it plays the way a player on the Mac does.
// The bot itself steers at any angle, which no keyboard can. Here everything it
// asks for goes through what a keyboard can send:
//
//   - eight directions, relative to the camera (up is away from it), each at
//     full speed, or nothing;
//   - the camera turns the way it does in the game (`cameraFor` and
//     `turnToward` in src/view/route-camera.ts), and the directions turn with it;
//   - in the air the keys stay as they were at take-off: a player picks a
//     direction and jumps. They may let go to stop short, but press no new
//     direction until the hero lands, swims or takes hold of a rope;
//   - a key held or let go stays that way for at least `KEY_HOLD` seconds:
//     nobody taps keys sixty times a second to steer between two directions,
//     and a quick tap is about a tenth of a second.
//
// Jump and the move button go through as the bot asks.

import { Game, type Input } from '../../src/game/game';
import { STEP } from '../../src/game/hero';
import { cameraFor, followsRoute, stickToLevel, turnToward } from '../../src/view/route-camera';
import { Bot } from './bot';

/** The shortest time a player keeps a direction key down, or up, before changing it. */
export const KEY_HOLD = 0.1;
/** A stick asked for less than this is no key at all; more is a key held fully. */
const PRESS = 0.5;

export class KeyboardPlayer {
  private readonly bot: Bot;
  private yaw: number;
  private lastStood: string | null;
  private readonly turns: boolean;
  /** The keys down now, as a screen direction (0 to 7, round from up), or null for none, and how long they have been. */
  private keys: number | null = null;
  private heldFor = Infinity;
  private wasGrounded = true;
  private locked = false;

  constructor(game: Game) {
    this.bot = new Bot(game.level);
    this.turns = followsRoute(game.level);
    this.lastStood = game.groundId;
    this.yaw = this.turns ? cameraFor(game.level, this.lastStood).facing : 0;
  }

  /** Which way the camera faces now, in degrees. */
  get facing(): number {
    return this.yaw;
  }

  input(game: Game): Input {
    // The camera, as the game moves it.
    if (this.turns) {
      if (game.groundId) this.lastStood = game.groundId;
      this.yaw = turnToward(this.yaw, cameraFor(game.level, this.lastStood).facing, STEP);
    }
    const wanted = this.bot.input(game);
    // What the bot asks for, as the player would see it on the screen.
    const screen = stickToLevel(wanted, -this.yaw);
    const amount = Math.hypot(screen.moveX, screen.moveZ);
    // Screen direction 0 is up (away from the camera, -z), counted round to the right.
    const keys = amount < PRESS ? null : (((Math.round(Math.atan2(screen.moveX, -screen.moveZ) / (Math.PI / 4)) % 8) + 8) % 8);
    this.heldFor += STEP;
    // In the air (not on a rope or in the water) the keys stay as they were at take-off: one direction for the whole jump.
    const flying = !game.grounded && !game.swimming && !game.swinging && game.climbing <= 0;
    // A bounce off a mushroom, or off an enemy or a boss after landing on it, is a landing and a new take-off:
    // a player picks a direction again.
    const bounced = game.events.some((event) => event.type === 'bounce' || event.type === 'strike' || (event.type === 'boss' && (event.what === 'hit' || event.what === 'blocked')));
    if (flying && (this.wasGrounded || bounced)) this.locked = !bounced;
    if (!flying) this.locked = false;
    this.wasGrounded = game.grounded;
    // Holding jumps, a player in the air may still let go of the keys to stop short, but presses no new direction.
    const allowed = !this.locked || keys === null;
    if (keys !== this.keys && this.heldFor >= KEY_HOLD && allowed) {
      this.keys = keys;
      this.heldFor = 0;
    }
    const angle = this.keys === null ? 0 : (this.keys * Math.PI) / 4;
    const pressed = this.keys === null ? { moveX: 0, moveZ: 0 } : { moveX: Math.sin(angle), moveZ: -Math.cos(angle) };
    return { ...stickToLevel({ ...wanted, ...pressed }, this.yaw) };
  }
}

/** Plays the level with the keyboard bot until the leaf is reached or time runs out. */
export const playWithKeyboard = (game: Game, maxSeconds = 300): Game => {
  const player = new KeyboardPlayer(game);
  for (let i = 0; i < maxSeconds / STEP && !game.complete; i += 1) game.step(player.input(game));
  return game;
};
