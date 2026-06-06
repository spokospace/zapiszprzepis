/**
 * PWA utilities for client-side service worker management
 * Only imported in client components (use 'use client')
 */

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

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
          console.log('[PWA] Update available - new service worker activated')
          // S-01 will add UI to prompt user to refresh
        }
      })
    })

    return registration
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
    return
  }
}

export function installPromptReady(): Promise<boolean> {
  return new Promise((resolve) => {
    let deferredPrompt: BeforeInstallPromptEvent | null = null

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      deferredPrompt = event as BeforeInstallPromptEvent
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
