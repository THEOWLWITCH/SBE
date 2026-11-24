// Offline cache for the credibility notebook only (registered with scope "./credibility-notebook").
const CACHE = 'credibility-notebook-v16';
const FILES = ['credibility-notebook.html', 'credibility-notebook.webmanifest', 'assets/credibility-notebook/icon-192.png', 'assets/credibility-notebook/icon-512.png', 'assets/credibility-notebook/photo.webp', 'assets/credibility-notebook/stamp.webp', 'assets/credibility-notebook/check.webp', 'assets/credibility-notebook/reader.webp', 'assets/credibility-notebook/laptop.webp', 'assets/credibility-notebook/evidence.webp', 'assets/credibility-notebook/fonts/frank-ruhl-libre-hebrew-300-normal.woff2', 'assets/credibility-notebook/fonts/frank-ruhl-libre-latin-300-normal.woff2', 'assets/credibility-notebook/fonts/frank-ruhl-libre-hebrew-500-normal.woff2', 'assets/credibility-notebook/fonts/frank-ruhl-libre-latin-500-normal.woff2', 'assets/credibility-notebook/fonts/rubik-hebrew-300-normal.woff2', 'assets/credibility-notebook/fonts/rubik-latin-300-normal.woff2', 'assets/credibility-notebook/fonts/rubik-hebrew-400-normal.woff2', 'assets/credibility-notebook/fonts/rubik-latin-400-normal.woff2', 'assets/credibility-notebook/fonts/rubik-hebrew-500-normal.woff2', 'assets/credibility-notebook/fonts/rubik-latin-500-normal.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('credibility-notebook-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Network first, so updates arrive; the cache answers when offline.
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
