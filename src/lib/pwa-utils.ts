/**
 * PWA utilities for client-side service worker management
 * Phase 3: Service worker registration + update notification
 * S-01: Will add UI for update prompts and install prompt
 *
 * Only imported in client components (use 'use client')
 */

let updateAvailable = false

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers not supported')
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
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
