'use client'

import { useCallback, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** sessionStorage read that never throws (private mode, blocked storage). */
export function readSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/** sessionStorage write that never throws; notifies every hook in this tab. */
export function writeSessionStorage(key: string, value: string | null): void {
  try {
    if (value == null) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, value)
  } catch {
    /* storage unavailable: the UI still works, it just does not persist */
  }
  listeners.forEach((l) => l())
}

/**
 * The raw string stored under `key` in this tab's sessionStorage (E01-S07 list bar
 * and checklists). Like useTextScale, it is backed by useSyncExternalStore: the server
 * snapshot is always null, so SSR and hydration match, and then the stored value takes
 * over. Callers parse the string themselves. A string snapshot is stable across reads,
 * so there are no render loops.
 */
export function useSessionStorage(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readSessionStorage(key),
    () => null,
  )
  const setValue = useCallback((next: string | null) => writeSessionStorage(key, next), [key])
  return [value, setValue]
}
