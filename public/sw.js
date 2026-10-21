// IRLog Service Worker v4 — Offline-First Resilient Caching with Subpath Support
const APP_CACHE = 'irlog-app-v4';
const DATA_CACHE = 'irlog-data-v1';
const AUTH_CACHE = 'irlog-auth-v1';

const CURRENT_CACHES = [APP_CACHE, DATA_CACHE, AUTH_CACHE];

// Derive the base path from the SW's own scope URL.
// When registered with scope "/irlog/", self.registration.scope will be
// "https://.../irlog/" and we extract "/irlog".
// When deployed at root, this resolves to "".
function getBasePath() {
  try {
    const scopeUrl = new URL(self.registration.scope);
    return scopeUrl.pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
}

// Helper: Network fetch with timeout to prevent hanging on offline servers
function fetchWithTimeout(request, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('Network timeout'));
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        if (!timedOut) {
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch((err) => {
        if (!timedOut) {
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

// Pre-cache core application shell on install
self.addEventListener('install', (event) => {
  const basePath = getBasePath();
  const preCacheRoutes = [
    basePath + '/offline.html',
    basePath + '/irLogo.svg',
    basePath + '/favicon.ico',
    basePath + '/icons/icon-192x192.png',
    basePath + '/icons/icon-512x512.png',
    basePath + '/icons/apple-touch-icon.png',
    basePath + '/worklist',
    basePath + '/',
    basePath + '/login',
  ];

  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      return Promise.allSettled(
        preCacheRoutes.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Pre-cache skipped for ${url}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!CURRENT_CACHES.includes(key)) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cacheable read-only API endpoints for offline viewing
const CACHEABLE_API_PATHS = [
  '/api/worklist',
  '/api/procedures',
  '/api/settings',
  '/api/holidays',
  '/api/procedures/list-all',
  '/api/procedures/physician',
  '/api/users/profile',
  '/api/logo'
];

function isCacheableApi(pathname) {
  return CACHEABLE_API_PATHS.some((api) => pathname.includes(api));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Handle Logout: Clear cached session on signOut
  if (url.pathname.includes('/api/auth/signout')) {
    event.waitUntil(caches.delete(AUTH_CACHE));
    return;
  }

  // 2. NextAuth Session Route: Network-First with Fallback to Cached Session
  if (url.pathname.includes('/api/auth/session') && req.method === 'GET') {
    event.respondWith(
      fetchWithTimeout(req, 6000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(AUTH_CACHE).then((cache) => cache.put(req.url, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const authCache = await caches.open(AUTH_CACHE);
          const cached = await authCache.match(req.url);
          if (cached) {
            // Return cached session with offline indicator header
            const cachedBody = await cached.clone().text();
            return new Response(cachedBody, {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-IRLog-Offline': 'true',
              },
            });
          }
          return new Response(JSON.stringify({ error: 'Session unavailable offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'X-IRLog-Offline': 'true' },
          });
        })
    );
    return;
  }

  // 3. Skip non-GET requests (mutations like POST, PUT, DELETE try network directly)
  if (req.method !== 'GET') {
    return;
  }

  // 4. Read APIs (Worklist, Procedures, Settings, etc.): Fast Network-First with Cache Fallback
  if (isCacheableApi(url.pathname)) {
    event.respondWith(
      fetchWithTimeout(req, 6000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(req.url, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const dataCache = await caches.open(DATA_CACHE);
          const cached = await dataCache.match(req.url);
          if (cached) {
            const cachedBody = await cached.clone().text();
            return new Response(cachedBody, {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-IRLog-Offline': 'true',
              },
            });
          }
          return new Response(JSON.stringify({ error: 'Server offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'X-IRLog-Offline': 'true' },
          });
        })
    );
    return;
  }

  // Skip other un-cacheable /api/ routes
  if (url.pathname.includes('/api/')) {
    return;
  }

  // 5. HTML Document Navigation: Fast Network-First with Page Cache Fallback
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        const basePath = getBasePath();
        const appCache = await caches.open(APP_CACHE);

        // If client is already offline, skip network delay and serve cache directly
        if (!navigator.onLine) {
          const cachedPage = await appCache.match(req.url);
          if (cachedPage) return cachedPage;

          // Try fallback to worklist or root
          const fallbackWorklist = await appCache.match(basePath + '/worklist');
          if (fallbackWorklist) return fallbackWorklist;

          const fallbackRoot = await appCache.match(basePath + '/');
          if (fallbackRoot) return fallbackRoot;

          const offlinePage = await appCache.match(basePath + '/offline.html');
          if (offlinePage) return offlinePage;
        }

        try {
          const networkResponse = await fetchWithTimeout(req, 6000);
          if (networkResponse && networkResponse.status === 200) {
            appCache.put(req.url, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // Server offline or network timed out — retrieve cached version
          const cachedPage = await appCache.match(req.url);
          if (cachedPage) return cachedPage;

          // Route fallback
          const fallbackWorklist = await appCache.match(basePath + '/worklist');
          if (fallbackWorklist) return fallbackWorklist;

          const fallbackRoot = await appCache.match(basePath + '/');
          if (fallbackRoot) return fallbackRoot;

          const offlinePage = await appCache.match(basePath + '/offline.html');
          if (offlinePage) return offlinePage;

          return new Response('<h1>IRLog Offline</h1><p>Server is offline and no cached page found.</p>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
          });
        }
      })()
    );
    return;
  }

  // 6. Next.js Static Assets & Media: Stale-While-Revalidate
  if (
    url.pathname.includes('/_next/static/') ||
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
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(APP_CACHE).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Silently ignore background refresh errors when offline
          });

        // Return from cache immediately if present; fetch in background
        return cachedResponse || fetchPromise;
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
  
  if (redirectUrl.startsWith('/') && basePath && !redirectUrl.startsWith(basePath)) {
    redirectUrl = basePath + redirectUrl;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(redirectUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(redirectUrl);
      }
    })
  );
});
