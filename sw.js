// MarketPro v4 — Service Worker
// App-shell caching + Web Push Notification handler

const CACHE = 'marketpro-v4-shell';
const SHELL = ['./index.html', './manifest.json', './css/main.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('cdnjs')) return;
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});

// ── PUSH ─────────────────────────────────────────
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data?.json() || {}; } catch { d = { title: e.data?.text() || 'MarketPro' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'MarketPro', {
    body:    d.body    || '',
    icon:    d.icon    || '/manifest.json',
    badge:   d.badge   || '/manifest.json',
    tag:     d.tag     || 'mp-' + Date.now(),
    data:    d.data    || {},
    vibrate: d.vibrate || [200, 100, 200],
    requireInteraction: false,
  }));
});

// ── NOTIFICATION CLICK ────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const konsumenId = e.notification.data?.konsumenId;
  const url        = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.registration.scope)) {
          c.focus();
          if (konsumenId) c.postMessage({ type: 'NOTIFICATION_CLICK', konsumenId });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── MESSAGE FROM PAGE (local push) ───────────────
self.addEventListener('message', e => {
  if (e.data?.type !== 'SHOW_NOTIFICATION') return;
  const d = e.data;
  self.registration.showNotification(d.title || 'MarketPro', {
    body:    d.body    || '',
    icon:    d.icon    || '/manifest.json',
    badge:   d.badge   || '/manifest.json',
    tag:     d.tag     || 'mp-' + Date.now(),
    data:    { konsumenId: d.data?.konsumenId, url: d.url },
    vibrate: d.vibrate || [200, 100, 200],
    requireInteraction: false,
  });
});

// ── PUSH SUBSCRIPTION CHANGE ─────────────────────
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options)
      .then(sub => clients.matchAll({ type: 'window' }).then(list =>
        list.forEach(c => c.postMessage({ type: 'PUSH_RESUBSCRIBED', subscription: sub.toJSON() }))
      ))
  );
});
