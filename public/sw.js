/**
 * ZapiszPrzepis Service Worker
 *
 * Phase 1: Minimal service worker for PWA criteria
 * Phase 2: Web Share Target request handling (current)
 * Phase 3: Precaching and cache strategies
 */

self.addEventListener('install', (event) => {
  console.log('[SW] Install event')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event')
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { method, url } = event.request

  // Web Share Target: ensure POST /share always goes to network
  // Browser sends form data via multipart/form-data, must hit server
  if (method === 'POST' && url.includes('/share')) {
    console.log('[SW] Web Share Target request - passing to network')
    // Don't cache, always hit server
    return
  }

  // Phase 2: Other requests - let network handle
  // Phase 3: Will add cache strategies for static assets and API
})

console.log('[SW] Service Worker loaded')
