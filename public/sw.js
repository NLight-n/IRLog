// IRLog Service Worker v3 — subpath-aware
const CACHE_NAME = 'irlog-cache-v3';

// Derive the base path from the SW's own scope URL.
// When registered with scope "/irlog/", self.registration.scope will be
// "https://claritymdt.snhrc.org/irlog/" and we extract "/irlog".
// When deployed at root, this resolves to "".
function getBasePath() {
  try {
    const scopeUrl = new URL(self.registration.scope);
    // Remove trailing slash to get the base path prefix
    return scopeUrl.pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
}

// Static assets to pre-cache on SW install (relative to SW scope)
const PRECACHE_ASSETS = [
  './offline.html',
  './irLogo.svg',
  './favicon.ico',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Failed to pre-cache some assets during SW install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip API and authentication routes from SW intercept
  if (url.pathname.includes('/api/')) return;

  // Handle HTML document / page navigation (Network-First)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('./offline.html');
          });
        })
    );
    return;
  }

  // Static Assets (Cache-First with Network fallback)
  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache and update cache in background
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {/* ignore background update failure */});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }
});

// Background Push Notification Event Listener
self.addEventListener('push', (event) => {
  const basePath = getBasePath();
  let data = { title: 'IRLog Alert', body: 'New update received.', url: basePath + '/worklist' };
  
  if (event.data) {
    try {
      const parsed = event.data.json();
      // Prefix incoming url with basePath if it's a relative path without it
      if (parsed.url && parsed.url.startsWith('/') && basePath && !parsed.url.startsWith(basePath)) {
        parsed.url = basePath + parsed.url;
      }
      data = parsed;
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: basePath + '/icons/icon-192x192.png',
    badge: basePath + '/icons/icon-192x192.png',
    tag: data.tag || `irlog-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || basePath + '/worklist'
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'IRLog Notification', options)
      .catch((err) => console.error('Error in showNotification:', err))
  );
});

// Handle push notification click and redirect user
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const basePath = getBasePath();
  let redirectUrl = event.notification.data?.url || basePath + '/worklist';
  
  // Ensure the URL is within the app scope
  if (redirectUrl.startsWith('/') && basePath && !redirectUrl.startsWith(basePath)) {
    redirectUrl = basePath + redirectUrl;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and redirect it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(redirectUrl);
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(redirectUrl);
      }
    })
  );
});
