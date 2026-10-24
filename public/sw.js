/**
 * Zapisz Przepis Service Worker
 *
 * Hand-written: next-pwa does not run under Turbopack, so this file is the
 * worker production serves. `src/lib/sw.test.ts` drives it through a fake
 * runtime — keep it a plain script with top-level function declarations.
 *
 * Cache strategy:
 * - `/_next/static/*` (content-hashed): cache-first
 * - other same-origin files (icons, manifest): network-first, cache as fallback
 * - public pages: network-first, cached for offline
 * - every other page: network-only
 * - offline fallback for pages: the cached page, else the cached home page,
 *   else an "Offline" response
 * - never intercepted: non-GET (Server Actions, Web Share Target, /api POSTs),
 *   /api/*, RSC requests (client navigations), cross-origin requests
 *
 * Versioning: the page registers `/sw.js?v=<build>`, so every deploy installs a
 * new worker with its own cache names and deletes the old caches on activate.
 * The new worker waits until every app window is closed — it never takes over
 * (and never reloads) open tabs. Sign-out clears every cache but the static one
 * (`clearPrivateCaches` in `src/lib/pwa-utils.ts`).
 */

const CACHE_PREFIX = 'zapiszprzepis-'
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const STATIC_CACHE_NAME = `${CACHE_PREFIX}static-${VERSION}`
const PAGES_CACHE_NAME = `${CACHE_PREFIX}pages-${VERSION}`

// Pages a guest can open. Everything else (signed-in screens, auth forms,
// onboarding) is never cached, so a new private route stays private by default.
const PUBLIC_PAGE_PATHS = [
  '/',
  '/szukaj',
  '/wyswietlanie',
  '/regulamin',
  '/polityka-prywatnosci',
  '/usuwanie-danych',
]
const PUBLIC_PAGE_PREFIXES = ['/przepis/', '/przepisy/', '/u/']

function isPublicPage(pathname) {
  return PUBLIC_PAGE_PATHS.includes(pathname) ||
    PUBLIC_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Picks how a request is handled:
 * - 'network': not intercepted, the browser fetches it as if there were no SW
 * - 'static': cache-first
 * - 'file': network-first, cache as fallback
 * - 'public-page': network-first, cached, offline fallback
 * - 'private-page': network-only, offline fallback
 */
function routeFor(request) {
  const url = new URL(request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'network'
  if (url.origin !== self.location.origin) return 'network'
  if (request.method !== 'GET') return 'network'
  if (url.pathname.startsWith('/api/')) return 'network'
  if (request.headers.get('RSC') !== null || url.searchParams.has('_rsc')) return 'network'

  if (url.pathname.startsWith('/_next/static/')) return 'static'
  if (url.pathname.startsWith('/_next/')) return 'network'
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return 'file'

  if (request.mode !== 'navigate') return 'network'
  return isPublicPage(url.pathname) ? 'public-page' : 'private-page'
}

async function putInCache(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
  } catch (err) {
    console.warn('[SW] Cache write failed:', err)
  }
}

// Fetches from the network and, when cacheName is set, stores a clean 200 in
// the background (event.waitUntil) so the page never waits on the cache write.
async function fetchAndStore(event, cacheName) {
  const response = await fetch(event.request)
  if (cacheName && response.status === 200 && !response.redirected) {
    event.waitUntil(putInCache(cacheName, event.request, response.clone()))
  }
  return response
}

async function cacheFirst(event) {
  return (await caches.match(event.request)) ?? fetchAndStore(event, STATIC_CACHE_NAME)
}

async function networkFirst(event) {
  try {
    return await fetchAndStore(event, STATIC_CACHE_NAME)
  } catch (err) {
    const cached = await caches.match(event.request)
    if (cached) return cached
    throw err
  }
}

async function offlineFallback(request) {
  return (await caches.match(request)) ??
    (await caches.match('/')) ??
    new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

async function page(event, cacheName) {
  try {
    return await fetchAndStore(event, cacheName)
  } catch {
    return offlineFallback(event.request)
  }
}

function handle(event) {
  switch (routeFor(event.request)) {
    case 'static': return cacheFirst(event)
    case 'file': return networkFirst(event)
    case 'public-page': return page(event, PAGES_CACHE_NAME)
    case 'private-page': return page(event, null)
    default: return null
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name !== STATIC_CACHE_NAME && name !== PAGES_CACHE_NAME)
        .map((name) => caches.delete(name))
    ))
  )
})

self.addEventListener('fetch', (event) => {
  const response = handle(event)
  if (response) event.respondWith(response)
})
