// PropMap — Service Worker v4.2
// Standar PWABuilder 2026: Network-first + Push + Background Sync + Offline fallback

const CACHE_NAME    = 'propmap-v4-3-20260328';
const OFFLINE_URL   = '/offline.html';

const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/main.css',
  '/js/config.js',
  '/js/plan.js',
  '/js/helpers.js',
  '/js/auth.js',
  '/js/data.js',
  '/js/ui.js',
  '/js/laporan.js',
  '/js/kalender.js',
  '/js/dokumen.js',
  '/js/target.js',
  '/js/push.js',
  '/js/offline.js',
  '/js/backup.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
];

// ── INSTALL ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
        PRECACHE.map(url => new Request(url, { cache: 'reload' }))
      ))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.warn('[SW] Precache partial fail:', err);
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE — hapus cache lama ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET dan external
  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin)) return;

  const isHTML = request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html');

  const isAsset = /\.(js|css|png|jpg|svg|woff2?|ico)$/.test(url.pathname);

  if (isHTML) {
    // NETWORK-FIRST untuk navigasi HTML
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then(cached => cached || new Response(
            '<h1>Offline</h1><p>Buka PropMap saat online dulu untuk caching.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          ))
        )
    );

  } else if (isAsset) {
    // NETWORK-FIRST untuk JS/CSS — selalu dapat versi terbaru
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            // Clone SEBELUM return — fix "body already used"
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );

  } else {
    // CACHE-FIRST untuk aset statis lain
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(c => c.put(request, clone));
            }
            return response;
          }).catch(() => caches.match(OFFLINE_URL));
        })
    );
  }
});

// ── PUSH ─────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = { title: 'PropMap', body: 'Ada notifikasi baru' };

  try {
    if (event.data) {
      const text = event.data.text();
      try { payload = JSON.parse(text); }
      catch { payload.body = text; }
    }
  } catch (err) {
    console.warn('[SW] Push parse error:', err);
  }

  const options = {
    body:               payload.body    || '',
    icon:               payload.icon    || '/icons/icon-192.png',
    badge:              payload.badge   || '/icons/icon-72.png',
    tag:                payload.tag     || 'propmap-' + Date.now(),
    data:               payload.data    || {},
    vibrate:            [200, 100, 200],
    requireInteraction: false,
    silent:             false,
    actions: payload.data?.konsumenId ? [
      { action: 'open',    title: 'Lihat Detail' },
      { action: 'dismiss', title: 'Tutup'        },
    ] : [],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'PropMap', options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const konsumenId = event.notification.data?.konsumenId;
  const targetUrl  = konsumenId
    ? `/?page=konsumen&id=${konsumenId}`
    : '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Fokus ke tab yang sudah terbuka
        for (const client of windowClients) {
          if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
            client.focus();
            if (konsumenId) {
              client.postMessage({ type: 'NOTIFICATION_CLICK', konsumenId });
            }
            return;
          }
        }
        // Buka tab baru
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── MESSAGE FROM PAGE ─────────────────────────────
self.addEventListener('message', event => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'SHOW_NOTIFICATION') {
    const d = event.data;
    self.registration.showNotification(d.title || 'PropMap', {
      body:    d.body    || '',
      icon:    d.icon    || '/icons/icon-192.png',
      badge:   d.badge   || '/icons/icon-72.png',
      tag:     d.tag     || 'propmap-' + Date.now(),
      data:    { konsumenId: d.data?.konsumenId },
      vibrate: [200, 100, 200],
    });
  }

  if (type === 'SYNC_NOW') {
    self.registration.sync?.register('sync-queue').catch(() => {});
  }
});

// ── BACKGROUND SYNC ───────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(
      clients
        .matchAll({ type: 'window' })
        .then(list => list.forEach(c => c.postMessage({ type: 'DO_SYNC' })))
    );
  }
});
