// A pretend browser storage for the tests: a plain map that can also be made
// to refuse, the way a private window or a full disk does.

import type { StorageLike } from '../../src/save/players';

export class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  /** When set, reading or writing (or both) throws. */
  broken: 'read' | 'write' | 'both' | null = null;
  writes = 0;

  getItem(key: string): string | null {
    if (this.broken === 'read' || this.broken === 'both') throw new Error('storage is blocked');
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.broken === 'write' || this.broken === 'both') throw new Error('storage is full');
    this.writes += 1;
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    if (this.broken === 'write' || this.broken === 'both') throw new Error('storage is blocked');
    this.items.delete(key);
  }

  get length(): number {
    if (this.broken === 'read' || this.broken === 'both') throw new Error('storage is blocked');
    return this.items.size;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
}
