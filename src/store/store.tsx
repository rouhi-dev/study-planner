import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buildDemoState } from '../data/demo';
import { todayISO } from '../lib/dates';
import {
  cloudAdapter,
  loadLocalSync,
  localAdapter,
  parseState,
  STORAGE_KEY,
  type StorageAdapter,
} from '../lib/storage';
import {
  AuthExpiredError,
  getSession,
  signIn as sbSignIn,
  signOut as sbSignOut,
  signUp as sbSignUp,
  supabaseAdapter,
  supabaseConfigured,
} from '../lib/supabase';
import type { AppState } from '../lib/types';

export type SyncStatus = 'local' | 'cloud' | 'error' | 'auth';

export const PRE_CLOUD_BACKUP_KEY = 'study-planner:v1:pre-cloud-backup';

interface StoreValue {
  state: AppState;
  /** Apply a pure transition. Returning the same object is a no-op. */
  update: (fn: (s: AppState) => AppState) => void;
  replaceState: (s: AppState) => void;
  sync: SyncStatus;
  saveError: string | null;
  /** Remote copy that was newer than local data on startup. */
  restoredFromCloud: boolean;
  /** Supabase account sync (null when this build has no Supabase config). */
  account: {
    email: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    /** Resolves false when e-mail confirmation is required before login. */
    signUp: (email: string, password: string) => Promise<boolean>;
    signOut: () => void;
  } | null;
}

const StoreContext = createContext<StoreValue | null>(null);

function initialState(): AppState {
  return loadLocalSync() ?? buildDemoState();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [sync, setSync] = useState<SyncStatus>('local');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restoredFromCloud, setRestored] = useState(false);
  const [authKey, setAuthKey] = useState(0);
  const cloud = useRef<StorageAdapter | null>(null);
  const skipNextSave = useRef(false);
  const latest = useRef(state);
  latest.current = state;

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      return { ...next, meta: { ...next.meta, updatedAt: Date.now() } };
    });
  }, []);

  const replaceState = useCallback((s: AppState) => {
    setState({ ...s, meta: { ...s.meta, updatedAt: Date.now() } });
  }, []);

  // Local persistence (debounced).
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const t = setTimeout(() => {
      localAdapter.save(state).then(
        () => setSaveError(null),
        () => setSaveError('ذخیره در حافظهٔ مرورگر انجام نشد. ممکن است فضای مرورگر پر یا مسدود باشد.'),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [state]);

  // Optional cloud copy: Claude artifact runtime, or a signed-in Supabase account.
  useEffect(() => {
    let cancelled = false;
    const resolveAdapter = async (): Promise<StorageAdapter | null> => {
      const artifact = await cloudAdapter();
      if (artifact) return artifact;
      const session = supabaseConfigured ? getSession() : null;
      return session ? supabaseAdapter(session.user.id) : null;
    };
    const pull = async (adapter: StorageAdapter) => {
      const remote = await adapter.load();
      if (cancelled) return;
      if (remote && remote.meta.updatedAt > latest.current.meta.updatedAt) {
        // Keep the replaced local copy so nothing is lost silently.
        try {
          if (!latest.current.meta.demo) localStorage.setItem(PRE_CLOUD_BACKUP_KEY, JSON.stringify(latest.current));
        } catch {
          /* quota: best effort */
        }
        setRestored(true);
        setState(remote);
      }
    };
    const fail = (e: unknown) => setSync(e instanceof AuthExpiredError ? 'auth' : 'error');
    cloud.current = null;
    resolveAdapter().then(async (adapter) => {
      if (cancelled || !adapter) return;
      try {
        await pull(adapter);
        if (cancelled) return;
        cloud.current = adapter;
        setSync('cloud');
      } catch (e) {
        fail(e);
      }
    });
    // Pick up edits made on another device when this tab comes back into view.
    const onVisible = () => {
      const adapter = cloud.current;
      if (document.visibilityState === 'visible' && adapter) pull(adapter).catch(fail);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authKey]);

  useEffect(() => {
    const adapter = cloud.current;
    if (!adapter) return;
    const t = setTimeout(() => {
      adapter.save(state).then(
        () => setSync('cloud'),
        (e) => setSync(e instanceof AuthExpiredError ? 'auth' : 'error'),
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [state, sync]);

  // Keep several open tabs consistent.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = parseState(JSON.parse(e.newValue));
        if (next) {
          skipNextSave.current = true;
          setState(next);
        }
      } catch {
        /* ignore malformed */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const account = useMemo<StoreValue['account']>(() => {
    if (!supabaseConfigured) return null;
    return {
      email: getSession()?.user.email ?? null,
      async signIn(email, password) {
        await sbSignIn(email, password);
        setAuthKey((k) => k + 1);
      },
      async signUp(email, password) {
        const session = await sbSignUp(email, password);
        if (session) setAuthKey((k) => k + 1);
        return !!session;
      },
      signOut() {
        sbSignOut();
        cloud.current = null;
        setSync('local');
        setAuthKey((k) => k + 1);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authKey, sync]);

  const value = useMemo(
    () => ({ state, update, replaceState, sync, saveError, restoredFromCloud, account }),
    [state, update, replaceState, sync, saveError, restoredFromCloud, account],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Current time, refreshed every `ms` (date rollover, focus timer). */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useToday(): string {
  return todayISO(useNow());
}

export function useCourse(id: string | undefined) {
  const { state } = useStore();
  return state.courses.find((c) => c.id === id);
}

/** Apply the theme preference to <html>. */
export function useThemeEffect(theme: AppState['settings']['theme']) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
