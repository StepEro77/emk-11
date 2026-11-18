// Keeps the page on the phone (Erik, 18 Nov 2026: on mobile data in China with no VPN the page sometimes loaded for ever, on a phone that
// had the files already it opened). One store, STORE, shared with the page script (app.js keeps every data file it downloads in it too).
//   page file   from the net, the kept copy only if the net gives nothing within PAGE_WAIT ms, so a new version always wins on a working line
//   ?v= files   script, style sheet, data: the stamp is the content, so a kept copy is always right and is used without asking the net.
//               Older stamps of the same file are thrown out when a new one comes in
//   the rest    (font, pictures) the kept copy at once, refreshed from the net behind it
// To switch this off for every phone: replace this file with one that calls self.registration.unregister() and deletes the store.
const STORE = 'emk-11', PAGE_WAIT = 6000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const q = e.request;
  if (q.method !== 'GET' || q.headers.has('range')) return;
  const u = new URL(q.url), scope = new URL(self.registration.scope);
  if (u.origin !== scope.origin || !u.pathname.startsWith(scope.pathname) || u.pathname.endsWith('/_check_parts.json') || u.pathname.endsWith('/sw.js')) return;
  if (q.mode === 'navigate' || u.pathname === scope.pathname || u.pathname === scope.pathname + 'index.html') e.respondWith(page(q));
  else if (u.searchParams.has('v')) e.respondWith(stamped(q, u));
  else e.respondWith(fresh(q));
});

async function page(q) {
  const c = await caches.open(STORE), key = self.registration.scope;
  const net = fetch(q).then((r) => { if (r.ok && !r.redirected) c.put(key, r.clone()); return r; });
  const old = await c.match(key);
  if (!old) return net;
  return Promise.race([net.then((r) => (r.ok ? r : old), () => old), new Promise((ok) => setTimeout(() => ok(old), PAGE_WAIT))]);
}

async function stamped(q, u) {
  const c = await caches.open(STORE), have = await c.match(u.href);
  if (have) return have;
  const r = await fetch(q);
  if (r.ok && r.status === 200) {
    const copy = r.clone();
    (async () => {
      for (const k of await c.keys()) { const o = new URL(k.url); if (o.pathname === u.pathname && o.href !== u.href) await c.delete(k); }
      await c.put(u.href, copy);
    })().catch(() => {});
  }
  return r;
}

async function fresh(q) {
  const c = await caches.open(STORE), have = await c.match(q);
  const net = fetch(q).then((r) => { if (r.ok && r.status === 200) c.put(q, r.clone()); return r; });
  if (have) { net.catch(() => {}); return have; }
  return net;
}
