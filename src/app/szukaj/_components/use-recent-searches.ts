'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { addRecentSearch, parseRecentSearches, RECENT_SEARCHES_KEY } from '@/lib/recent-searches'

const listeners = new Set<() => void>()

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(RECENT_SEARCHES_KEY)
  } catch {
    return null
  }
}

function write(value: string | null): void {
  try {
    if (value == null) window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    else window.localStorage.setItem(RECENT_SEARCHES_KEY, value)
  } catch {
    /* private mode / blocked storage: search works, it just has no history */
  }
  listeners.forEach((l) => l())
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * This device's „Ostatnio szukane” (E01-S26). The snapshot is the raw string (stable
 * across reads, so no render loops); the server snapshot is null, so SSR and
 * hydration match and the stored list appears right after.
 */
export function useRecentSearches() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null)
  const recent = parseRecentSearches(raw)
  const add = useCallback((q: string) => {
    const next = addRecentSearch(parseRecentSearches(readRaw()), q)
    write(JSON.stringify(next))
  }, [])
  const clear = useCallback(() => write(null), [])
  return { recent, add, clear }
}
