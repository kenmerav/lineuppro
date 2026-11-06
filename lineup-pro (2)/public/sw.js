const CACHE_NAME = 'lineuppro-offline-v2';
const APP_SHELL = ['/index.html', '/logo.svg', '/manifest.webmanifest'];

const cacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  const homeResponse = await fetch('/');
  if (!homeResponse.ok) throw new Error('Could not cache the app shell.');

  await cache.put('/', homeResponse.clone());
  const html = await homeResponse.text();
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith('/') && !path.startsWith('/api/'));

  await Promise.all([...new Set([...APP_SHELL, ...assetPaths])].map(async (path) => {
    try {
      await cache.add(path);
    } catch (error) {
      console.error(`Could not cache ${path}`, error);
    }
  }));
};

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match('/')) || (await caches.match('/index.html'))),
    );
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});
