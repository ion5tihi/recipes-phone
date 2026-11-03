// Service worker of the phone copy. Generated into recipes-phone by tools\build_phone.py
// (76360e9d51 = hash of index.html + manifest + icons, so a new shell installs a new worker).
const SHELL = 'shell-76360e9d51';
const DATA = 'data';    // recipes.json (replaced only when the user taps "оновити")
const FILES = 'files';  // pictures, PDFs, breakdown pages: key = canonical URL "<path>?v=<hash>"
const SCOPE = new URL(self.registration.scope);
const abs = p => new URL(p, SCOPE).href;
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const encPath = rel => rel.split('/').map(encodeURIComponent).join('/');

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(SHELL);
  await c.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' })));
  const d = await caches.open(DATA);
  if (!(await d.match(abs('recipes.json')))) {
    const r = await fetch(abs('recipes.json'), { cache: 'reload' });
    if (r.ok) await d.put(abs('recipes.json'), r);
  }
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('shell-') && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

let MAP = null;  // path -> hash, from the cached recipes.json
async function fileMap(){
  if (MAP) return MAP;
  const r = await (await caches.open(DATA)).match(abs('recipes.json'));
  const m = new Map();
  if (r) for (const [p, , h] of (await r.json()).files) m.set(p, h);
  return (MAP = m);
}

self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
  if (e.data === 'reload-map') MAP = null;
});

async function fileFirst(rel){
  const h = (await fileMap()).get(rel);
  const key = abs(encPath(rel) + (h ? '?v=' + h : ''));
  const c = await caches.open(FILES);
  const hit = await c.match(key);
  if (hit) return hit;
  try {
    const r = await fetch(key);
    if (r.ok && h) await c.put(key, r.clone());
    return r;
  } catch (err) {
    return new Response('Немає інтернету, а цей файл ще не збережено на телефоні.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(req, name){
  const hit = await caches.match(req, { cacheName: name, ignoreSearch: req.mode === 'navigate' });
  if (hit) return hit;
  if (req.mode === 'navigate') {
    const idx = await caches.match(abs('index.html'), { cacheName: SHELL });
    try { return await fetch(req); } catch (err) { if (idx) return idx; throw err; }
  }
  const r = await fetch(req);
  if (r.ok && name === DATA) (await caches.open(DATA)).put(req.url, r.clone());
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const rel = decodeURIComponent(url.pathname.slice(SCOPE.pathname.length));
  if (rel === 'recipes.json') {
    if (url.search) return;                       // update check: always network
    e.respondWith(cacheFirst(new Request(abs('recipes.json')), DATA));
  } else if (rel.startsWith('r/') || rel.startsWith('t/')) {
    e.respondWith(fileFirst(rel));
  } else if (rel === 'sw.js') {
    return;
  } else {
    e.respondWith(cacheFirst(req, SHELL));
  }
});
