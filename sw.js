// PropMap v4.2 — Service Worker
// App-shell caching + Offline support + Push Notification

const CACHE_VER = 'propmap-v4-2';
const SHELL = [
  './', './index.html', './manifest.json',
  './css/main.css',
  './js/config.js', './js/helpers.js', './js/auth.js',
  './js/data.js', './js/ui.js', './js/laporan.js',
  './js/kalender.js', './js/dokumen.js',
  './js/target.js', './js/push.js', './js/offline.js',
];

// ── INSTALL ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER).then(c => {
      return Promise.allSettled(SHELL.map(url => c.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // External APIs — network only, no caching
  const isExternal = ['supabase.co','supabase.io','googleapis.com',
    'gstatic.com','jsdelivr.net','cdnjs.cloudflare.com'].some(h => url.hostname.includes(h));
  if (isExternal) return;

  // POST / non-GET — network only
  if (e.request.method !== 'GET') return;

  // App shell — cache first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache fresh JS/CSS
        if (res.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
          caches.open(CACHE_VER).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => {
        // Offline fallback — return index.html untuk navigasi
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

// ── PUSH ─────────────────────────────────────────
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data?.json() || {}; } catch { d = { title: e.data?.text() || 'PropMap' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'PropMap', {
    body: d.body || '', icon: d.icon || '/manifest.json',
    badge: '/manifest.json', tag: d.tag || 'mp-' + Date.now(),
    data: d.data || {}, vibrate: [200, 100, 200],
  }));
});

// ── NOTIFICATION CLICK ────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const konsumenId = e.notification.data?.konsumenId;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.registration.scope)) {
          c.focus();
          if (konsumenId) c.postMessage({ type: 'NOTIFICATION_CLICK', konsumenId });
          return;
        }
      }
      return clients.openWindow('/');
    })
  );
});

// ── MESSAGE FROM PAGE ─────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const d = e.data;
    self.registration.showNotification(d.title || 'PropMap', {
      body: d.body || '', icon: d.icon || '/manifest.json',
      badge: '/manifest.json', tag: d.tag || 'mp-' + Date.now(),
      data: { konsumenId: d.data?.konsumenId, url: d.url },
      vibrate: [200, 100, 200],
    });
  }
  // Trigger sync dari halaman
  if (e.data?.type === 'SYNC_NOW') {
    self.registration.sync?.register('sync-queue').catch(() => {});
  }
});

// ── BACKGROUND SYNC ───────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-queue') {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(list =>
        list.forEach(c => c.postMessage({ type: 'DO_SYNC' }))
      )
    );
  }
});
