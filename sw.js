/* Farshchi PWA service worker: caches only the application shell, never business data. */
'use strict';
const CACHE_NAME = 'farshchi-pwa-v1';
const BASE_URL = self.registration.scope;
const INDEX_URL = new URL('index.html', BASE_URL).href;
const SHELL_URLS = [
  INDEX_URL,
  new URL('manifest.json', BASE_URL).href,
  new URL('icons/icon-192.png', BASE_URL).href,
  new URL('icons/icon-512.png', BASE_URL).href,
  new URL('icons/icon-192-maskable.png', BASE_URL).href,
  new URL('icons/icon-512-maskable.png', BASE_URL).href
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('farshchi-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE_URL)) return;

  if (request.mode === 'navigate') {
    // Prefer the live version so deployments update normally; use cached app shell offline.
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(INDEX_URL);
        if (cached) return cached;
        return new Response('فرشچی در حالت آفلاین در دسترس نیست. ابتدا یک‌بار آنلاین برنامه را باز کنید.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Network-first for shell resources, cache fallback for offline use and refresh cache on success.
  if (SHELL_URLS.includes(url.href)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(request)) || Response.error();
      }
    })());
  }
});
