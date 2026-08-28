/* ============================================================
   ROUTIQ HEALTH — Service Worker (Phase 3 PWA)
   Caches app shell, map tiles, OSRM and Nominatim API responses
   ============================================================ */

const APP_CACHE   = 'routiq-app-v1';
const TILE_CACHE  = 'routiq-tiles-v1';
const API_CACHE   = 'routiq-api-v1';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './phase345.js',
  './manifest.json',
  './facilities.seed.json',
  './facilities.vellore.seed.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// ---------- INSTALL: cache app shell ----------
self.addEventListener('install', event => {
  console.log('[SW] Install: caching app shell');
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' }))))
      .catch(err => console.warn('[SW] App shell cache partial failure:', err))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE: purge old caches ----------
self.addEventListener('activate', event => {
  const CURRENT = [APP_CACHE, TILE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !CURRENT.includes(k)).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ---------- FETCH: routing strategy by request type ----------
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (POST to Claude API etc.)
  if (req.method !== 'GET') return;

  // 1. Map tiles — cache-first (long-lived tiles rarely change)
  if (
    url.hostname.includes('carto') ||
    url.hostname.includes('tile.openstreetmap') ||
    url.pathname.includes('/tiles/')
  ) {
    event.respondWith(cacheFirst(req, TILE_CACHE));
    return;
  }

  // 2. OSRM routing API — network-first, cache fallback
  if (url.hostname.includes('project-osrm.org') || url.hostname.includes('router.project-osrm')) {
    event.respondWith(networkFirstWithCache(req, API_CACHE));
    return;
  }

  // 3. Nominatim geocoding — network-first, cache fallback
  if (url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(networkFirstWithCache(req, API_CACHE));
    return;
  }

  // 4. Google Fonts & CDN assets — stale-while-revalidate
  if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('unpkg.com')) {
    event.respondWith(staleWhileRevalidate(req, APP_CACHE));
    return;
  }

  // 5. App shell files — cache-first
  event.respondWith(cacheFirst(req, APP_CACHE));
});

// ---------- Strategy Helpers ----------

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return new Response('Offline — resource unavailable', { status: 503 });
  }
}

async function networkFirstWithCache(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) {
      console.log('[SW] Network failed, serving cached API response for:', req.url);
      return cached;
    }
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No cached response available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(fresh => {
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || fetchPromise;
}

// ---------- Background Sync: facility DB sync ----------
self.addEventListener('sync', event => {
  if (event.tag === 'facility-sync') {
    console.log('[SW] Background sync: facility database update triggered');
  }
});

// ---------- Push Notifications (stub for Phase 5 extension) ----------
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'ROUTIQ HEALTH', body: 'Emergency alert' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './manifest.json',
      badge: './manifest.json',
      tag: 'routiq-alert',
      renotify: true
    })
  );
});
