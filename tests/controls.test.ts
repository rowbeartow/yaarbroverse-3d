import { describe, expect, it } from 'vitest';
import { keysToMove, stickToMove } from '../src/input/controls';
import { formatTime, needsTurning } from '../src/ui/screens';

describe('the touch stick', () => {
  it('ignores a thumb resting near the middle', () => {
    expect(stickToMove(0.1, -0.1)).toEqual({ moveX: 0, moveZ: 0 });
  });

  it('pushes fully when the thumb is at the rim', () => {
    expect(stickToMove(1, 0)).toEqual({ moveX: 1, moveZ: 0 });
    const up = stickToMove(0, -1);
    expect(up.moveX).toBeCloseTo(0, 10);
    expect(up.moveZ).toBe(-1);
  });

  it('never pushes harder than fully, however far the thumb drags', () => {
    const far = stickToMove(3, 4);
    expect(Math.hypot(far.moveX, far.moveZ)).toBeCloseTo(1, 10);
  });

  it('walks slowly for a small push and faster for a bigger one', () => {
    const small = stickToMove(0.4, 0).moveX;
    const big = stickToMove(0.8, 0).moveX;
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThan(1);
  });

  it('dragging up the screen means away from the camera', () => {
    expect(stickToMove(0, -0.9).moveZ).toBeLessThan(0);
    expect(stickToMove(0, 0.9).moveZ).toBeGreaterThan(0);
  });
});

describe('the direction keys', () => {
  it('map to left, right, away and toward', () => {
    expect(keysToMove(true, false, false, false)).toEqual({ moveX: -1, moveZ: 0 });
    expect(keysToMove(false, true, false, false)).toEqual({ moveX: 1, moveZ: 0 });
    expect(keysToMove(false, false, true, false)).toEqual({ moveX: 0, moveZ: -1 });
    expect(keysToMove(false, false, false, true)).toEqual({ moveX: 0, moveZ: 1 });
  });

  it('cancel out when opposite keys are held', () => {
    expect(keysToMove(true, true, false, false)).toEqual({ moveX: 0, moveZ: 0 });
  });

  it('are no stronger on a diagonal', () => {
    const { moveX, moveZ } = keysToMove(false, true, true, false);
    expect(Math.hypot(moveX, moveZ)).toBeCloseTo(1, 10);
  });
});

describe('the "turn sideways" card', () => {
  it('shows on a touch device held upright', () => {
    expect(needsTurning(true, 820, 1180)).toBe(true);
  });

  it('does not show on a touch device held sideways', () => {
    expect(needsTurning(true, 1180, 820)).toBe(false);
  });

  it('still shows when the device is sideways but its screen is locked upright', () => {
    // With rotation lock on, the page keeps its upright shape whichever way
    // the device is held, so the same rule catches it.
    expect(needsTurning(true, 820, 1180)).toBe(true);
  });

  it('never shows on a computer, even in a tall window', () => {
    expect(needsTurning(false, 600, 1000)).toBe(false);
  });
});

describe('the end card time', () => {
  it('shows minutes, seconds and tenths', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(7.25)).toBe('0:07.2');
    expect(formatTime(67.4)).toBe('1:07.4');
    expect(formatTime(600)).toBe('10:00.0');
  });
});
