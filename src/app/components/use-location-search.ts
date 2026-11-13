'use client'

import { useSyncExternalStore } from 'react'

const NAVIGATE_EVENT = 'zp:location-search'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

/**
 * The address's query string, read in the browser only. The server and the first
 * client render see '' (the bare page), so a page saved as a file hydrates without a
 * mismatch whatever query it was opened with, and then renders for the real one.
 *
 * Not `useSearchParams` + Suspense as on /szukaj: there the saved file holds the
 * skeleton, which is fine for a search page; a category list must hold its cards for
 * readers before hydration and for crawlers. A dynamic render with `useSearchParams`
 * would also bake one query's result into HTML that the file serves for every query.
 */
export function useLocationSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  )
}

const noSubscription = () => () => {}

/** False on the server and in the first client render, true once the page has hydrated. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
}

/**
 * Change the address without asking the server for anything: native pushState, which
 * the Next.js router keeps in sync. The list re-renders from data it already has.
 */
export function pushLocation(href: string): void {
  window.history.pushState(null, '', href)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}
