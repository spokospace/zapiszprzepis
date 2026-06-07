/**
 * ZapiszPrzepis Service Worker
 *
 * Phase 1: Minimal service worker for PWA criteria
 * Phase 2: Web Share Target request handling
 * Phase 3: Precaching and cache strategies (current)
 *
 * Cache Strategy:
 * - Static assets (JS, CSS, fonts): cache-first (validate after 30d)
 * - API routes: network-first with 3600s timeout
 * - HTML pages: network-first, fallback to stale cache
 * - Web Share Target: always network
 */

const PRECACHE_NAME = 'zapiszprzepis-precache-v1'
const RUNTIME_CACHE_NAME = 'zapiszprzepis-runtime'
const API_CACHE_NAME = 'zapiszprzepis-api'

// Workbox precache manifest (injected by next-pwa at build time)
// eslint-disable-next-line no-undef
const PRECACHE_MANIFEST = self.__PRECACHE_MANIFEST || []

self.addEventListener('install', (event) => {
  console.log('[SW] Install event')
  self.skipWaiting()

  // Cache precache manifest
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => {
      const urls = PRECACHE_MANIFEST.map((entry) => {
        return typeof entry === 'string' ? entry : entry.url
      })
      return cache.addAll(urls).catch((err) => {
        console.warn('[SW] Precache addAll failed (may be expected in dev):', err)
      })
    })
  )
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event')
  event.waitUntil(clients.claim())

  // Clean up old cache versions
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== PRECACHE_NAME &&
              cacheName !== RUNTIME_CACHE_NAME &&
              cacheName !== API_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

self.addEventListener('fetch', (event) => {
  const { method, url } = event.request
  const urlObj = new URL(url)
  const pathname = urlObj.pathname

  // Web Share Target: always network (no caching)
  if (method === 'POST' && pathname === '/share') {
    return event.respondWith(fetch(event.request))
  }

  // API routes: network-first with timeout
  if (pathname.startsWith('/api/')) {
    return event.respondWith(
      Promise.race([
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone())
            })
          }
          return response
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('API timeout')), 3000)
        ),
      ]).catch(() => {
        return caches.match(event.request) ||
               new Response('Offline', { status: 503 })
      })
    )
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (/\.(js|css|woff2?|png|svg|jpg|jpeg|gif|webp|ico)$/.test(pathname)) {
    return event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (!response.ok) return response

          // Clone immediately — response body stream may be consumed by browser
          const responseToCache = response.clone()
          caches.open(PRECACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
          return response
        }).catch(() => {
          return new Response('Offline', { status: 503 })
        })
      })
    )
  }

  // HTML pages: network-first, fallback to stale cache
  if (method === 'GET' && !pathname.startsWith('/_')) {
    return event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(RUNTIME_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(event.request) ||
                 caches.match('/') ||
                 new Response('Offline', { status: 503 })
        })
    )
  }

  // Default: network only
  return event.respondWith(fetch(event.request))
})

console.log('[SW] Service Worker loaded (Phase 3: Caching enabled)')
