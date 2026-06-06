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
    // Register service worker after hydration
    registerServiceWorker().catch((error) => {
      console.error('[PWA] Registration failed:', error)
    })
  }, [])

  // No UI in Phase 3; S-01 will add update prompt
  return null
}
