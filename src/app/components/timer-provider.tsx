'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  TIMERS_STORAGE_KEY,
  endTimer,
  extendTimer,
  hasEnded,
  isRunning,
  loadTimers,
  pauseTimer,
  resumeTimer,
  saveTimers,
  startTimer,
  type RecipeTimer,
  type TimerState,
} from '@/lib/timer-store'

export type NewTimer = Pick<RecipeTimer, 'name' | 'recipeSlug' | 'recipeTitle' | 'step' | 'next' | 'addMin'>

type TimerContextValue = {
  timers: TimerState
  /** Wall-clock time, refreshed once a second while any timer runs. */
  now: number
  runningCount: number
  start: (timer: NewTimer, minutes: number) => void
  pause: (id: string) => void
  resume: (id: string) => void
  extend: (id: string, addMin: number) => void
  end: (id: string) => void
}

const noop = () => {}

/** Without a provider (static render, tests) there are simply no timers; nothing throws. */
const TimerContext = createContext<TimerContextValue>({
  timers: [],
  now: 0,
  runningCount: 0,
  start: noop,
  pause: noop,
  resume: noop,
  extend: noop,
  end: noop,
})

const EMPTY: TimerState = []

// One shared snapshot per tab, like the sessionStorage hook: `null` means "not read yet". Every
// write goes through `update`, which keeps the snapshot, localStorage and listeners in step.
const listeners = new Set<() => void>()
let snapshot: TimerState | null = null

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readSnapshot(): TimerState {
  if (snapshot === null) snapshot = loadTimers(localStorageOrNull())
  return snapshot
}

function update(change: (state: TimerState) => TimerState): void {
  snapshot = change(readSnapshot())
  saveTimers(localStorageOrNull(), snapshot)
  listeners.forEach((listener) => listener())
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  // Another tab changed the timers: read them again.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== TIMERS_STORAGE_KEY) return
    snapshot = null
    onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

/**
 * Holds the in-page timers for the whole site (#611, Phase 1). Mounted once in the root layout so a
 * timer keeps running when the reader moves between pages. The stored state is read through
 * useSyncExternalStore, so the server render and the first client render agree (no timers).
 */
export function TimerProvider({ children }: { children: ReactNode }) {
  const timers = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY)
  const [now, setNow] = useState(() => Date.now())
  // Timers are announced only after this page has seen them running, so a timer that ended while
  // the reader was away does not vibrate on arrival.
  const sawRunning = useRef<Set<string>>(new Set())
  const announced = useRef<Set<string>>(new Set())

  const runningCount = timers.filter(isRunning).length

  useEffect(() => {
    if (runningCount === 0) return
    const tick = () => {
      const current = Date.now()
      setNow(current)
      for (const timer of timers) {
        if (!isRunning(timer)) continue
        if (!hasEnded(timer, current)) {
          sawRunning.current.add(timer.id)
        } else if (sawRunning.current.has(timer.id) && !announced.current.has(timer.id)) {
          announced.current.add(timer.id)
          // Vibrate only when the page is visible; a hidden tab is covered by the push in Phase 2.
          if (document.visibilityState === 'visible') navigator.vibrate?.([300, 150, 300])
        }
      }
    }
    const handle = window.setInterval(tick, 1000)
    return () => window.clearInterval(handle)
  }, [runningCount, timers])

  // Each action refreshes `now` first: the page may have been idle, and the new endsAt must not be
  // measured against a stale clock until the next tick.
  const start = useCallback((timer: NewTimer, minutes: number) => {
    const current = Date.now()
    setNow(current)
    update((state) => startTimer(state, { id: newId(), ...timer }, minutes * 60_000, current))
  }, [])

  const pause = useCallback((id: string) => {
    const current = Date.now()
    setNow(current)
    update((state) => pauseTimer(state, id, current))
  }, [])

  const resume = useCallback((id: string) => {
    const current = Date.now()
    setNow(current)
    update((state) => resumeTimer(state, id, current))
  }, [])

  const extend = useCallback((id: string, addMin: number) => {
    const current = Date.now()
    setNow(current)
    announced.current.delete(id)
    update((state) => extendTimer(state, id, addMin * 60_000, current))
  }, [])
  const end = useCallback((id: string) => {
    announced.current.delete(id)
    sawRunning.current.delete(id)
    update((state) => endTimer(state, id))
  }, [])

  const value = useMemo<TimerContextValue>(
    () => ({ timers, now, runningCount, start, pause, resume, extend, end }),
    [timers, now, runningCount, start, pause, resume, extend, end],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimers(): TimerContextValue {
  return useContext(TimerContext)
}
