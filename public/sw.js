/**
 * ZapiszPrzepis Service Worker - Phase 1 (Minimal stub)
 *
 * Phase 1: Minimal service worker for PWA criteria
 * Phase 2: Will add Web Share Target request handling
 * Phase 3: Will add precaching and cache strategies
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
  // Phase 1: Let network handle all requests
  // Phase 2/3 will add caching strategies
})

console.log('[SW] Service Worker loaded')
