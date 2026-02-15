// JANNAH Service Worker - Production Version
const CACHE_NAME = 'jannah-v1.0.0';
const RUNTIME_CACHE = 'jannah-runtime-v1';

// Essential files to cache on install
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('JANNAH: Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('JANNAH: Cache failed during install', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('JANNAH: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first for APIs, Cache first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle API requests - Network first with cache fallback
  if (url.hostname.includes('api.alquran.cloud') || url.hostname.includes('api.aladhan.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone and cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return a custom offline response for APIs
              return new Response(JSON.stringify({
                error: 'Offline',
                message: 'No internet connection. Please try again when online.'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }
  
  // Handle app assets - Cache first with network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request).then(response => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            
            return response;
          });
        })
    );
    return;
  }
  
  // For everything else, just fetch
  event.respondWith(fetch(event.request));
});

// Handle messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
