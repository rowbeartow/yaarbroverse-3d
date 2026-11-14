// Where ghosts are kept on a device: the browser's database (IndexedDB),
// which has room for every ghost the roadmap's levels could need. The
// browser's local storage, where they used to be, holds about 5 MB for the
// whole site, shared with every GitHub Pages project on the same address,
// and four players' ghosts across five levels would outgrow it.
//
// The game reads and writes ghosts without waiting: this store keeps a copy
// of every ghost in memory and writes changes to the database behind the
// scenes. `open` fills the copy from the database before the first run, and
// moves any ghosts still in local storage into the database, removing each
// from local storage only once the database holds it.
//
// Where the database is blocked or missing (some private windows), it falls
// back to local storage, as before. Nothing here ever throws.

import { GHOST_PREFIX } from './ghosts';
import type { StorageLike } from './players';

const DATABASE = 'yaarbroverse-3d';
const SHELF = 'ghosts';

/** The parts of IndexedDB the store uses, so tests can hand it a stand-in. */
export type Databases = Pick<IDBFactory, 'open'>;

const done = (request: IDBRequest | IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    if ('oncomplete' in request) {
      request.oncomplete = () => resolve();
      request.onerror = () => reject(request.error);
      request.onabort = () => reject(request.error);
    } else {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  });

export class GhostStore implements StorageLike {
  private readonly copy = new Map<string, string>();
  /** Ghosts kept before `open` finished, written to the database once it has. */
  private readonly early = new Set<string>();
  private database: IDBDatabase | null = null;
  /** True once `open` has finished, whatever it found. */
  ready = false;
  /** Where ghosts are being kept: the database, local storage, or (with both blocked) only until the page closes. */
  kept: 'database' | 'local' | 'memory' = 'memory';

  constructor(
    private readonly databases: Databases | null,
    private readonly local: StorageLike | null,
  ) {}

  /** Fills the copy from the database and moves old ghosts out of local storage. Never throws. */
  async open(): Promise<void> {
    try {
      if (!this.databases) throw new Error('No database');
      const request = this.databases.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(SHELF)) request.result.createObjectStore(SHELF);
      };
      this.database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Blocked'));
      });
      // Everything already in the database.
      const reading = this.database.transaction(SHELF, 'readonly').objectStore(SHELF);
      const keys = reading.getAllKeys();
      const values = reading.getAll();
      await Promise.all([done(keys), done(values)]);
      keys.result.forEach((key, i) => {
        if (typeof key === 'string' && typeof values.result[i] === 'string') this.copy.set(key, values.result[i] as string);
      });
      this.kept = 'database';
      await this.moveFromLocal();
      for (const key of this.early) this.write(key, this.copy.get(key) ?? null);
    } catch {
      // No database: keep using local storage.
      this.database = null;
      this.kept = this.local ? 'local' : 'memory';
    }
    this.ready = true;
  }

  /** Ghosts still in local storage go into the database, then out of local storage. One that is newer in the database stays. */
  private async moveFromLocal(): Promise<void> {
    const local = this.local;
    if (!local || typeof local.length !== 'number' || !local.key) return;
    const found: Array<[string, string]> = [];
    try {
      for (let i = 0; i < local.length; i += 1) {
        const key = local.key(i);
        const text = key?.startsWith(GHOST_PREFIX) ? local.getItem(key) : null;
        if (key && text !== null) found.push([key, text]);
      }
    } catch {
      return;
    }
    if (!found.length || !this.database) return;
    const moving = found.filter(([key]) => !this.copy.has(key));
    const writing = this.database.transaction(SHELF, 'readwrite');
    for (const [key, text] of moving) writing.objectStore(SHELF).put(text, key);
    await done(writing);
    for (const [key, text] of moving) this.copy.set(key, text);
    // Only now that the database holds them.
    for (const [key] of found) {
      try {
        local.removeItem(key);
      } catch {
        // Left behind: it is moved again next time, harmlessly.
      }
    }
  }

  private write(key: string, text: string | null): void {
    if (this.database) {
      try {
        const writing = this.database.transaction(SHELF, 'readwrite');
        if (text === null) writing.objectStore(SHELF).delete(key);
        else writing.objectStore(SHELF).put(text, key);
        // A failed write leaves the copy for this visit; the ghost is simply not there next time.
        done(writing).catch(() => undefined);
      } catch {
        // As above.
      }
      return;
    }
    if (this.kept === 'local' && this.local) {
      if (text === null) this.local.removeItem(key);
      else this.local.setItem(key, text);
    }
  }

  getItem(key: string): string | null {
    if (this.kept === 'local' && this.local) {
      try {
        return this.local.getItem(key);
      } catch {
        return null;
      }
    }
    return this.copy.get(key) ?? null;
  }

  /** Throws only where local storage itself throws (full), so a ghost that does not fit is reported as not kept. */
  setItem(key: string, value: string): void {
    if (this.kept === 'local' && this.local) {
      this.local.setItem(key, value);
      return;
    }
    this.copy.set(key, value);
    if (!this.ready) this.early.add(key);
    this.write(key, value);
  }

  removeItem(key: string): void {
    if (this.kept === 'local' && this.local) {
      try {
        this.local.removeItem(key);
      } catch {
        // Nothing to do.
      }
      return;
    }
    this.copy.delete(key);
    if (!this.ready) this.early.add(key);
    this.write(key, null);
  }

  get length(): number {
    if (this.kept === 'local' && this.local) return this.local.length ?? 0;
    return this.copy.size;
  }

  key(index: number): string | null {
    if (this.kept === 'local' && this.local) return this.local.key?.(index) ?? null;
    return [...this.copy.keys()][index] ?? null;
  }
}
