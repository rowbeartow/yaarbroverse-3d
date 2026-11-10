// Reads the keyboard and the touch screen and turns them into the one thing the
// game rules understand: which way to move, and whether Jump is held.
//
// Keyboard: arrows or WASD move, Space jumps.
// Touch: drag anywhere on the left half to move (a stick appears under the
// thumb), press anywhere on the right half to jump.

import type { Input } from '../game/game';

/** Turns a stick offset (in stick radiuses) into a move amount, ignoring tiny wobbles. */
export const stickToMove = (offsetX: number, offsetY: number): { moveX: number; moveZ: number } => {
  const deadZone = 0.18;
  const length = Math.hypot(offsetX, offsetY);
  if (length < deadZone) return { moveX: 0, moveZ: 0 };
  const amount = Math.min((length - deadZone) / (1 - deadZone), 1);
  return { moveX: (offsetX / length) * amount, moveZ: (offsetY / length) * amount };
};

/** Turns the four direction keys into a move amount. */
export const keysToMove = (left: boolean, right: boolean, up: boolean, down: boolean): { moveX: number; moveZ: number } => {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const z = (down ? 1 : 0) - (up ? 1 : 0);
  const length = Math.hypot(x, z) || 1;
  return { moveX: x / length, moveZ: z / length };
};

/** Keeps a finger's later moves coming to the zone it started in, even if it slides out. */
const capture = (zone: HTMLElement, pointerId: number): void => {
  try {
    zone.setPointerCapture(pointerId);
  } catch {
    // Some browsers refuse for a pointer that has already lifted. Nothing is lost.
  }
};

const KEY_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_UP = new Set(['ArrowUp', 'KeyW']);
const KEY_DOWN = new Set(['ArrowDown', 'KeyS']);
const KEY_JUMP = new Set(['Space']);

export class Controls {
  private readonly held = new Set<string>();
  private stick = { moveX: 0, moveZ: 0 };
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private readonly jumpPointers = new Set<number>();

  constructor(
    stickZone: HTMLElement,
    private readonly stickBase: HTMLElement,
    private readonly stickKnob: HTMLElement,
    private readonly jumpZone: HTMLElement,
  ) {
    window.addEventListener('keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (this.isGameKey(event.code)) {
        // Only while playing: on the menus Space and the arrows work as usual.
        if (this.enabled) event.preventDefault();
        this.held.add(event.code);
      }
    });
    window.addEventListener('keyup', (event) => this.held.delete(event.code));
    window.addEventListener('blur', () => this.release());

    stickZone.addEventListener('pointerdown', (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault();
      this.stickPointer = event.pointerId;
      capture(stickZone, event.pointerId);
      // The stick appears where the thumb lands.
      this.stickOrigin = { x: event.clientX, y: event.clientY };
      const zone = stickZone.getBoundingClientRect();
      const half = stickBase.offsetWidth / 2;
      stickBase.style.left = `${event.clientX - zone.left - half}px`;
      stickBase.style.top = `${event.clientY - zone.top - half}px`;
      stickBase.style.bottom = 'auto';
      this.moveStick(event);
    });
    stickZone.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.stickPointer) this.moveStick(event);
    });
    const endStick = (event: PointerEvent): void => {
      if (event.pointerId === this.stickPointer) this.releaseStick();
    };
    stickZone.addEventListener('pointerup', endStick);
    stickZone.addEventListener('pointercancel', endStick);

    jumpZone.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      capture(jumpZone, event.pointerId);
      this.jumpPointers.add(event.pointerId);
      jumpZone.classList.add('down');
    });
    const endJump = (event: PointerEvent): void => {
      this.jumpPointers.delete(event.pointerId);
      if (this.jumpPointers.size === 0) jumpZone.classList.remove('down');
    };
    jumpZone.addEventListener('pointerup', endJump);
    jumpZone.addEventListener('pointercancel', endJump);

    // Stop the page from scrolling, zooming or opening menus under the thumbs.
    for (const zone of [stickZone, jumpZone]) {
      zone.addEventListener('contextmenu', (event) => event.preventDefault());
      zone.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
    }
    document.addEventListener('gesturestart', (event) => event.preventDefault());
  }

  /** Set while a game is being played, so game keys do not scroll or click things. */
  enabled = false;

  private isGameKey(code: string): boolean {
    return KEY_LEFT.has(code) || KEY_RIGHT.has(code) || KEY_UP.has(code) || KEY_DOWN.has(code) || KEY_JUMP.has(code);
  }

  private any(keys: Set<string>): boolean {
    for (const key of keys) if (this.held.has(key)) return true;
    return false;
  }

  private moveStick(event: PointerEvent): void {
    const reach = this.stickBase.offsetWidth / 2 || 60;
    const dx = (event.clientX - this.stickOrigin.x) / reach;
    const dy = (event.clientY - this.stickOrigin.y) / reach;
    const length = Math.hypot(dx, dy);
    const shown = length > 1 ? 1 / length : 1;
    this.stickKnob.style.transform = `translate(${dx * shown * reach * 0.62}px, ${dy * shown * reach * 0.62}px)`;
    this.stick = stickToMove(dx * shown, dy * shown);
  }

  private releaseStick(): void {
    this.stickPointer = null;
    this.stick = { moveX: 0, moveZ: 0 };
    this.stickKnob.style.transform = '';
    this.stickBase.style.left = '';
    this.stickBase.style.top = '';
    this.stickBase.style.bottom = '';
  }

  /** Lets go of everything, for when the game pauses or loses focus. */
  release(): void {
    this.held.clear();
    this.jumpPointers.clear();
    this.jumpZone.classList.remove('down');
    this.releaseStick();
  }

  /** What the player is asking for right now. */
  read(): Input {
    const keys = keysToMove(this.any(KEY_LEFT), this.any(KEY_RIGHT), this.any(KEY_UP), this.any(KEY_DOWN));
    const useStick = this.stickPointer !== null;
    return {
      moveX: useStick ? this.stick.moveX : keys.moveX,
      moveZ: useStick ? this.stick.moveZ : keys.moveZ,
      jump: this.any(KEY_JUMP) || this.jumpPointers.size > 0,
    };
  }
}
