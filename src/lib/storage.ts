/**
 * Persistence, kept separate from the UI.
 *
 * - `localAdapter` saves to localStorage in this browser (always tried first,
 *   synchronous load so the first paint already shows the user's data).
 * - `cloudAdapter` is used only when the app runs as a published Claude
 *   artifact with the `db` capability: it keeps a private per-user copy so data
 *   survives across devices. Anywhere else it resolves to null.
 */
import type { AppState } from './types';

export const STORAGE_KEY = 'study-planner:v1';

export interface StorageAdapter {
  readonly name: string;
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
}

/** Light structural validation for loaded or imported data. */
export function parseState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<AppState>;
  if (s.version !== 1) return null;
  const arrays = ['courses', 'tasks', 'commitments', 'sessions', 'cards', 'reviews'] as const;
  if (!arrays.every((k) => Array.isArray(s[k]))) return null;
  if (!s.settings || typeof s.settings !== 'object' || !s.meta) return null;
  if (!s.focus) s.focus = { status: 'idle', targetMin: s.settings.focusDefaultMin ?? 50, accumulatedMs: 0 };
  return s as AppState;
}

export function loadLocalSync(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export const localAdapter: StorageAdapter = {
  name: 'local',
  async load() {
    return loadLocalSync();
  },
  async save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
};

// ---- optional cloud copy (Claude artifact runtime) -----------------------------

interface DocSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface DbNamespace {
  doc(path: string): DocRef;
}
interface UserNamespace {
  id(): Promise<string | null>;
}
interface ClaudeRuntime {
  use(name: 'db'): Promise<DbNamespace | null>;
  use(name: 'user'): Promise<UserNamespace | null>;
}

export async function cloudAdapter(): Promise<StorageAdapter | null> {
  const runtime = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!runtime?.use) return null;
  try {
    const [db, user] = await Promise.all([runtime.use('db'), runtime.use('user')]);
    const id = user ? await user.id() : null;
    if (!db || !id) return null;
    const ref = db.doc(`data/users/${id}/planner`);
    let writing: Promise<void> = Promise.resolve();
    return {
      name: 'cloud',
      async load() {
        const snap = await ref.get();
        const json = snap.exists ? snap.data()?.json : undefined;
        return typeof json === 'string' ? parseState(JSON.parse(json)) : null;
      },
      save(state) {
        // One write at a time per document.
        writing = writing
          .catch(() => undefined)
          .then(() => ref.set({ json: JSON.stringify(state), updatedAt: state.meta.updatedAt }));
        return writing;
      },
    };
  } catch {
    return null;
  }
}
