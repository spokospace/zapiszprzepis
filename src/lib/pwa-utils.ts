/**
 * PWA utilities for client-side service worker management
 * Phase 3: Service worker registration + update notification
 * S-01: Will add UI for update prompts and install prompt
 *
 * Only imported in client components (use 'use client')
 */

let updateAvailable = false

// Keep in sync with the cache names in public/sw.js.
const CACHE_PREFIX = 'zapiszprzepis-'
const STATIC_CACHE_PREFIX = `${CACHE_PREFIX}static-`

/**
 * The worker URL carries the build version, so each deploy registers a new
 * worker whose caches replace the previous build's (see public/sw.js).
 */
export function serviceWorkerUrl(version = process.env.NEXT_PUBLIC_SW_VERSION): string {
  return version ? `/sw.js?v=${encodeURIComponent(version)}` : '/sw.js'
}

/**
 * Deletes every cache the worker keeps except the content-hashed static files,
 * so pages rendered for a signed-in user are gone once they sign out. Never
 * throws: sign-out must go ahead even where Cache Storage is unavailable.
 */
export async function clearPrivateCaches(cacheStorage: CacheStorage | undefined = globalThis.caches): Promise<void> {
  if (!cacheStorage) return
  try {
    const names = await cacheStorage.keys()
    await Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_PREFIX) && !name.startsWith(STATIC_CACHE_PREFIX))
        .map((name) => cacheStorage.delete(name))
    )
  } catch (error) {
    console.warn('[PWA] Clearing caches failed:', error)
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers not supported')
    return
  }

  try {
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl(), {
      scope: '/',
    })
    console.log('[PWA] Service Worker registered:', registration)

    // Check for updates periodically
    setInterval(() => {
      registration.update()
    }, 60000) // Check every 60s

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
          console.log('[PWA] Update available - new service worker activated')
          updateAvailable = true
          // Dispatch custom event for S-01 UI to listen
          window.dispatchEvent(new CustomEvent('pwa-update-available'))
        }
      })
    })

    return registration
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
    return
  }
}

export function isUpdateAvailable(): boolean {
  return updateAvailable
}

export function reloadForUpdate(): void {
  if (updateAvailable) {
    window.location.reload()
  }
}

export function installPromptReady(): Promise<boolean> {
  return new Promise((resolve) => {
    let deferredPrompt: BeforeInstallPromptEvent | null = null

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      deferredPrompt = event as BeforeInstallPromptEvent
      console.log('[PWA] Install prompt ready')
      resolve(true)
    })

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed')
      deferredPrompt = null
    })

    // If no prompt event fires after 2s, resolve with false
    setTimeout(() => {
      resolve(deferredPrompt !== null)
    }, 2000)
  })
}

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
