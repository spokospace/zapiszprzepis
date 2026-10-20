'use client'

import { useSyncExternalStore } from 'react'

/** Where the recipe page's header back link leads: the list the visitor came from. */
export interface HeaderBackTarget {
  label: string
  href: string
}

let target: HeaderBackTarget | null = null
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/**
 * Below lg the recipe page has no list bar of its own (C3, E01-S28): the header
 * shows „← {lista}” instead. The header renders in the layout, above the page that
 * knows the list, so the page publishes the target here and the header reads it.
 */
export function setHeaderBackTarget(next: HeaderBackTarget | null): void {
  if (target?.label === next?.label && target?.href === next?.href) return
  target = next
  listeners.forEach((l) => l())
}

/** Null on the server and until the recipe page publishes a list, so SSR and hydration match. */
export function useHeaderBackTarget(): HeaderBackTarget | null {
  return useSyncExternalStore(
    subscribe,
    () => target,
    () => null,
  )
}
