'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa-utils'

/**
 * PWA Service Worker Registration Component
 *
 * Registers the service worker at runtime (Phase 3).
 * S-01 will add UI for update notifications.
 *
 * @see src/lib/pwa-utils.ts for registration logic
 */
export function PWARegister() {
  useEffect(() => {
    // In development next-pwa is disabled, so there is no fresh service worker
    // to register — a lingering one from a prior prod build only serves stale
    // Turbopack chunks ("module factory is not available"). Proactively
    // unregister any existing worker instead of registering.
    if (process.env.NODE_ENV !== 'production') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister())
        })
      }
      return
    }

    // Register service worker after hydration
    registerServiceWorker().catch((error) => {
      console.error('[PWA] Registration failed:', error)
    })
  }, [])

  // No UI in Phase 3; S-01 will add update prompt
  return null
}
