// ==============================================================================
// PC MALL - LIGHTWEIGHT SERVICE WORKER (PWA & OFFLINE RESILIENCE)
// ==============================================================================
const CACHE_NAME = "pcmall-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/favicon.svg",
  "/manifest.json"
];

// 1. Install & pre-cache critical shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Cache addAll warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate & cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch strategy: Network-first for API & navigation, Cache-first for static icons/styles
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and WebSocket / API requests
  if (event.request.method !== "GET" || url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) {
    return;
  }

  // Static assets (images, icons, fonts): Stale-while-revalidate
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|css)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Navigation (HTML shell): Network-first with offline cache fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match("/");
      })
    );
  }
});

