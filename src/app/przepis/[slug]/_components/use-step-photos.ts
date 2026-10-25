'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Remembered globally (not per recipe), so the choice carries across recipes. */
const STEP_PHOTOS_KEY = 'stepPhotos'
const listeners = new Set<() => void>()

/** Step photos show unless the stored value is `'0'`; unset (or anything else) means shown. */
function readShowPhotos(): boolean {
  try {
    return window.localStorage.getItem(STEP_PHOTOS_KEY) !== '0'
  } catch {
    return true
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  // Another tab's change fires a storage event; mirror it into this tab.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STEP_PHOTOS_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * The step-photos toggle („Zdjęcia kroków: Pokaż / Ukryj”, ZMIANY §3) — a global per-device
 * preference. „Tryb gotowania” (now in the action row) and the steps list (far below) both
 * read it, so „Ukryj” reaches both even though they no longer sit together. Backed by
 * useSyncExternalStore like useTextScale / useSessionStorage: a module-level store needs no
 * provider around the page, the server snapshot is the default (shown) so SSR and hydration
 * match, and a change notifies every reader — this tab and other tabs.
 */
export function useStepPhotos(): { showPhotos: boolean; setShowPhotos: (show: boolean) => void } {
  const showPhotos = useSyncExternalStore(subscribe, readShowPhotos, () => true)
  const setShowPhotos = useCallback((show: boolean) => {
    try {
      window.localStorage.setItem(STEP_PHOTOS_KEY, show ? '1' : '0')
    } catch {
      // storage blocked — the toggle still works for this view, it just won't persist
    }
    listeners.forEach((l) => l())
  }, [])
  return { showPhotos, setShowPhotos }
}
