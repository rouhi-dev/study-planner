import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';

// Minimal in-memory mock of the Supabase endpoints the app uses.
const store = new Map<string, unknown>();
let tokens = 0;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code: number, obj: unknown) => (res.writeHead(code, { 'content-type': 'application/json' }), res.end(JSON.stringify(obj)));
    const url = req.url ?? '';
    const auth = req.headers.authorization ?? '';
    if (url.startsWith('/auth/v1/token')) {
      const b = JSON.parse(body);
      if (url.includes('refresh_token')) return b.refresh_token === 'r1' ? send(200, { access_token: `a${++tokens}`, refresh_token: 'r1', expires_in: 3600, user: { id: 'u1' } }) : send(400, { msg: 'bad' });
      return b.password === 'secret1' ? send(200, { access_token: 'a0', refresh_token: 'r1', expires_in: 3600, user: { id: 'u1', email: b.email } }) : send(400, { msg: 'Invalid login' });
    }
    if (url.startsWith('/rest/v1/planner_state')) {
      if (!auth.startsWith('Bearer a') || auth === 'Bearer a0-stale') return send(401, {});
      if (req.method === 'GET') return send(200, store.has('u1') ? [{ data: store.get('u1') }] : []);
      store.set('u1', JSON.parse(body).data);
      return send(201, {});
    }
    send(404, {});
  });
});

test('supabase adapter: login, save, load, refresh, expiry', async () => {
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const mem = new Map<string, string>();
  Object.assign(globalThis, {
    __SUPABASE_URL__: `http://127.0.0.1:${port}`,
    __SUPABASE_ANON_KEY__: 'anon',
    localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
  });
  const sb = await import('../src/lib/supabase');
  const { buildDemoState } = await import('../src/data/demo');
  assert.equal(sb.supabaseConfigured, true);
  await assert.rejects(sb.signIn('a@b.c', 'wrong'));
  const s = await sb.signIn('a@b.c', 'secret1');
  const adapter = sb.supabaseAdapter(s.user.id);
  assert.equal(await adapter.load(), null);
  const demo = buildDemoState();
  await adapter.save(demo);
  assert.equal((await adapter.load())?.meta.updatedAt, demo.meta.updatedAt);
  // expired access token → transparent refresh
  mem.set(sb.AUTH_KEY, JSON.stringify({ ...s, access_token: 'bad', expires_at: 1 }));
  assert.ok(await adapter.load());
  assert.notEqual(sb.getSession()?.access_token, 'bad');
  // refresh token revoked → AuthExpiredError and session cleared
  mem.set(sb.AUTH_KEY, JSON.stringify({ ...s, refresh_token: 'dead', expires_at: 1 }));
  await assert.rejects(adapter.load(), sb.AuthExpiredError);
  assert.equal(sb.getSession(), null);
  server.close();
});
