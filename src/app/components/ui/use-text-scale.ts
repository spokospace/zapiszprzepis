'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Content text-size levels (handoff: A / A+ / A++ → 1 / 1.15 / 1.3). */
export type TextScaleLevel = 'A' | 'A+' | 'A++'

export const TEXT_SCALE_VALUES: Record<TextScaleLevel, number> = {
  A: 1,
  'A+': 1.15,
  'A++': 1.3,
}

export const TEXT_SCALE_LEVELS: TextScaleLevel[] = ['A', 'A+', 'A++']

const STORAGE_KEY = 'zp-text-scale'
const listeners = new Set<() => void>()

function readStored(): TextScaleLevel {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'A+' || v === 'A++' ? v : 'A'
  } catch {
    return 'A'
  }
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
 * Per-device content text-size, persisted in localStorage (E01-S07 recipe screen).
 * Backed by useSyncExternalStore: the server snapshot is always 'A' (so SSR and the
 * first client render match), then the stored value takes over. Returns the level, its
 * numeric scale, a setter, and a style object to spread on the scalable container so
 * `--text-scale` reaches `.text-scalable` descendants.
 */
export function useTextScale() {
  const level = useSyncExternalStore(
    subscribe,
    readStored,
    () => 'A' as TextScaleLevel,
  )

  const setLevel = useCallback((next: TextScaleLevel) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode / blocked storage: no persistence this session */
    }
    listeners.forEach((l) => l())
  }, [])

  const scale = TEXT_SCALE_VALUES[level]
  const scaleStyle = { '--text-scale': String(scale) } as React.CSSProperties

  return { level, scale, setLevel, scaleStyle }
}
