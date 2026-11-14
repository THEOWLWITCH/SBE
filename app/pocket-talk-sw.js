// Offline cache for the pocket booklet only (registered with scope "./pocket-talk").
const CACHE = 'pocket-talk-v2';
const FILES = [
  'pocket-talk.html', 'pocket-talk.webmanifest', 'assets/begood-logo-mark.webp',
  'assets/pocket-talk/p1.webp', 'assets/pocket-talk/p2.webp', 'assets/pocket-talk/p3.webp',
  'assets/pocket-talk/p4.webp', 'assets/pocket-talk/p5.webp',
  'assets/pocket-talk/icon-192.png', 'assets/pocket-talk/icon-512.png',
  'assets/pocket-talk/pocket-talk.pdf'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pocket-talk-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
