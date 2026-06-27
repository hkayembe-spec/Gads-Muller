const STATIC_CACHE_NAME = 'nova-casino-static-v2';
const API_CACHE_NAME = 'nova-casino-api-v2';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
  '/src/assets/images/nova_casino_logo_1782028636027.jpg'
];

// Install Event - Pre-cache core structural frame
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-cache warning (some files might be lazy-loaded or missing in this build):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale cache databases from prior versions
self.addEventListener('activate', (event) => {
  const cacheAllowList = [STATIC_CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (!cacheAllowList.includes(cache)) {
            console.log('Suppression de l\'ancien cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Dynamic routing and advanced strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests through service worker caching
  if (request.method !== 'GET') {
    return;
  }

  // Skip Firebase sockets, live synchronizations, and firestore internal operations
  if (
    url.pathname.includes('/firestore') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  // 1. API GET Requests - NETWORK FIRST, FALLBACK TO CACHE
  // This allows the latest synced data to be retrieved offline instantly.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If valid response, save to API cache
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network failed (Offline), try the cached version
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return customized JSON structure indicating offline access
            return new Response(
              JSON.stringify({ 
                error: "Vous êtes actuellement hors connexion. Accès limité aux données synchronisées en cache.", 
                offline: true,
                data: [] 
              }), 
              {
                status: 200, // Keep status safe for code consumption
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // 2. Static Resources & Third-Party CSS/Fonts - STALE-WHILE-REVALIDATE
  // Speeds up loading by using cached copy immediately, whilst pulling and caching fresh files.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });

      if (cachedResponse) {
        // En cas d'erreur de mise à jour en arrière-plan, ignorer l'erreur pour ne pas polluer la console
        fetchPromise.catch((err) => {
          console.debug('Background update failed for:', request.url, err);
        });
        return cachedResponse;
      }

      return fetchPromise;
    })
  );
});
