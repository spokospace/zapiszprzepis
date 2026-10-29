/**
 * Recipe timers in the browser (#611, Phase 1). Every timer keeps an absolute `endsAt` while it
 * runs, so a background tab or a reload never delays the end; pausing stores the time left.
 * The reducers are pure; `loadTimers` / `saveTimers` are the only code touching localStorage.
 */
export type RecipeTimer = {
  id: string
  name: string
  recipeSlug: string | null
  recipeTitle: string | null
  step: number | null
  next: string | null
  addMin: 1 | 3 | 5
  /** Set while running: the wall-clock time the timer ends. */
  endsAt: number | null
  /** Set while paused: the time left when it was paused. */
  remaining: number | null
}

export type TimerState = RecipeTimer[]

export const TIMERS_STORAGE_KEY = 'zp-timers'

export function remainingMs(timer: RecipeTimer, now: number): number {
  if (timer.endsAt === null) return timer.remaining ?? 0
  return Math.max(0, timer.endsAt - now)
}

export function isRunning(timer: RecipeTimer): boolean {
  return timer.endsAt !== null
}

export function hasEnded(timer: RecipeTimer, now: number): boolean {
  return timer.endsAt !== null && timer.endsAt <= now
}

export function startTimer(state: TimerState, timer: Omit<RecipeTimer, 'endsAt' | 'remaining'>, durationMs: number, now: number): TimerState {
  return [...state, { ...timer, endsAt: now + durationMs, remaining: null }]
}

export function pauseTimer(state: TimerState, id: string, now: number): TimerState {
  return state.map((t) => (t.id === id && isRunning(t) ? { ...t, remaining: remainingMs(t, now), endsAt: null } : t))
}

export function resumeTimer(state: TimerState, id: string, now: number): TimerState {
  return state.map((t) => (t.id === id && !isRunning(t) ? { ...t, endsAt: now + (t.remaining ?? 0), remaining: null } : t))
}

/** Adds time to a timer whether it runs or is paused; a timer that has ended restarts from now. */
export function extendTimer(state: TimerState, id: string, extraMs: number, now: number): TimerState {
  return state.map((t) => {
    if (t.id !== id) return t
    if (t.endsAt === null) return { ...t, remaining: (t.remaining ?? 0) + extraMs }
    const base = Math.max(t.endsAt, now)
    return { ...t, endsAt: base + extraMs }
  })
}

export function endTimer(state: TimerState, id: string): TimerState {
  return state.filter((t) => t.id !== id)
}

/** Defensive read: anything malformed becomes "no timers", never a throw. */
export function parseTimers(raw: string | null): TimerState {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTimer)
  } catch {
    return []
  }
}

function isTimer(value: unknown): value is RecipeTimer {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  const addOk = t.addMin === 1 || t.addMin === 3 || t.addMin === 5
  const timeOk = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v))
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    addOk &&
    timeOk(t.endsAt) &&
    timeOk(t.remaining) &&
    (t.endsAt !== null || t.remaining !== null)
  )
}

/** Storage can be blocked or full (private window); the page must still work without it. */
export function loadTimers(storage: Pick<Storage, 'getItem'> | null): TimerState {
  try {
    return parseTimers(storage ? storage.getItem(TIMERS_STORAGE_KEY) : null)
  } catch {
    return []
  }
}

export function saveTimers(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, state: TimerState): void {
  try {
    if (!storage) return
    if (state.length === 0) storage.removeItem(TIMERS_STORAGE_KEY)
    else storage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota or blocked storage: the timers keep working in memory until the page closes.
  }
}
