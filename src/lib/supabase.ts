/**
 * Optional private cloud copy on Supabase (Auth + one RLS-protected table).
 *
 * Uses only the public anon key; row-level security (see supabase/schema.sql)
 * guarantees a signed-in user can read and write nothing but their own row.
 * Both values are injected at build time (`SUPABASE_URL`, `SUPABASE_ANON_KEY`);
 * when absent the whole feature is disabled and the app stays local-only.
 */
import type { AppState } from './types';
import { parseState, type StorageAdapter } from './storage';

declare const __SUPABASE_URL__: string | undefined;
declare const __SUPABASE_ANON_KEY__: string | undefined;

const URL_BASE = (typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '').replace(/\/+$/, '');
const ANON_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';
export const AUTH_KEY = 'study-planner:auth';

export const supabaseConfigured = Boolean(URL_BASE && ANON_KEY);

export interface Session {
  access_token: string;
  refresh_token: string;
  /** Unix seconds. */
  expires_at: number;
  user: { id: string; email?: string };
}

export class AuthExpiredError extends Error {
  constructor() {
    super('session expired');
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    return s?.access_token && s.refresh_token && s.user?.id ? s : null;
  } catch {
    return null;
  }
}

function storeSession(s: Session | null) {
  if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  else localStorage.removeItem(AUTH_KEY);
}

function toSession(body: Record<string, unknown>): Session | null {
  const user = body.user as Session['user'] | undefined;
  if (typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string' || !user?.id) return null;
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  const expiresAt = typeof body.expires_at === 'number' ? body.expires_at : Math.floor(Date.now() / 1000) + expiresIn;
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: expiresAt, user: { id: user.id, email: user.email } };
}

async function authRequest(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${URL_BASE}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = String(json.msg ?? json.error_description ?? json.message ?? res.status);
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return json;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const s = toSession(await authRequest('token?grant_type=password', { email, password }));
  if (!s) throw new Error('invalid response');
  storeSession(s);
  return s;
}

/** Returns null when the project requires e-mail confirmation first. */
export async function signUp(email: string, password: string): Promise<Session | null> {
  const s = toSession(await authRequest('signup', { email, password }));
  storeSession(s);
  return s;
}

export function signOut() {
  const s = getSession();
  storeSession(null);
  if (s) {
    void fetch(`${URL_BASE}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => undefined);
  }
}

let refreshing: Promise<Session> | null = null;
function refresh(): Promise<Session> {
  refreshing ??= (async () => {
    const cur = getSession();
    if (!cur) throw new AuthExpiredError();
    try {
      const s = toSession(await authRequest('token?grant_type=refresh_token', { refresh_token: cur.refresh_token }));
      if (!s) throw new AuthExpiredError();
      storeSession(s);
      return s;
    } catch (e) {
      // Only a rejected token ends the session; network errors keep it for retry.
      const status = (e as { status?: number }).status;
      if (e instanceof AuthExpiredError || (status !== undefined && status >= 400 && status < 500)) {
        storeSession(null);
        throw new AuthExpiredError();
      }
      throw e;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function authed(path: string, init: RequestInit = {}): Promise<Response> {
  let s = getSession();
  if (!s) throw new AuthExpiredError();
  if (s.expires_at - 60 < Date.now() / 1000) s = await refresh();
  const call = (token: string) =>
    fetch(`${URL_BASE}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    });
  let res = await call(s.access_token);
  if (res.status === 401) res = await call((await refresh()).access_token);
  return res;
}

export function supabaseAdapter(userId: string): StorageAdapter {
  let writing: Promise<void> = Promise.resolve();
  return {
    name: 'supabase',
    async load() {
      const res = await authed('planner_state?select=data&limit=1');
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const rows = (await res.json()) as { data: unknown }[];
      return rows[0] ? parseState(rows[0].data) : null;
    },
    save(state: AppState) {
      writing = writing
        .catch(() => undefined)
        .then(async () => {
          const res = await authed('planner_state?on_conflict=user_id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ user_id: userId, data: state, updated_at: new Date().toISOString() }),
          });
          if (!res.ok) throw new Error(`save failed (${res.status})`);
        });
      return writing;
    },
  };
}
