// SMART-HOSCHECK PWA Service Worker
// ทุก cache ของระบบนี้ต้องขึ้นต้นด้วย prefix เพื่อไม่แตะ cache ของระบบอื่นบนโดเมนเดียวกัน
const CACHE_PREFIX = 'hd-check-';
const CACHE_NAME = CACHE_PREFIX + 'static-v13';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Never intercept localhost / dev server requests
  if (
    self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1' ||
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('/@vite/') ||
    event.request.url.includes('/@react-refresh')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('Network offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
