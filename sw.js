// MarketPro v2 — Service Worker
// App-shell caching: cache app UI, always fetch data fresh from Supabase

const CACHE = 'marketpro-v2-shell';
const SHELL = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase API calls — always network
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    return;
  }
  // App shell — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
