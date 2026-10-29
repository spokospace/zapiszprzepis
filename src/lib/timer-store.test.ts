import { describe, it, expect, vi } from 'vitest'
import {
  TIMERS_STORAGE_KEY,
  endTimer,
  extendTimer,
  formatClock,
  hasEnded,
  loadTimers,
  parseTimers,
  pauseTimer,
  remainingMs,
  resumeTimer,
  saveTimers,
  startTimer,
  type RecipeTimer,
} from '@/lib/timer-store'

const base = { id: 'a', name: 'Wyrastanie', recipeSlug: 'bulki', recipeTitle: 'Bułki', step: 3, next: null, addMin: 5 as const }

describe('timer reducers', () => {
  it('runs from an absolute endsAt, so time keeps passing while the page is in the background', () => {
    const state = startTimer([], base, 30_000, 1_000)
    expect(state[0].endsAt).toBe(31_000)
    expect(remainingMs(state[0], 11_000)).toBe(20_000)
    expect(hasEnded(state[0], 31_000)).toBe(true)
    expect(remainingMs(state[0], 99_000)).toBe(0)
  })

  it('pause stores the time left and resume starts a new endsAt from it', () => {
    let state = startTimer([], base, 60_000, 0)
    state = pauseTimer(state, 'a', 20_000)
    expect(state[0]).toMatchObject({ endsAt: null, remaining: 40_000 })
    state = resumeTimer(state, 'a', 100_000)
    expect(state[0]).toMatchObject({ endsAt: 140_000, remaining: null })
  })

  it('extend adds to a running timer, a paused one, and restarts an ended one from now', () => {
    let state = startTimer([], base, 60_000, 0)
    state = extendTimer(state, 'a', 180_000, 10_000)
    expect(state[0].endsAt).toBe(240_000)

    state = pauseTimer(state, 'a', 50_000)
    state = extendTimer(state, 'a', 60_000, 60_000)
    expect(state[0]).toMatchObject({ endsAt: null, remaining: 250_000 })

    let ended = startTimer([], base, 1_000, 0)
    ended = extendTimer(ended, 'a', 60_000, 5_000)
    expect(ended[0].endsAt).toBe(65_000)
  })

  it('ends only the timer with the given id', () => {
    let state = startTimer([], base, 1_000, 0)
    state = startTimer(state, { ...base, id: 'b' }, 1_000, 0)
    expect(endTimer(state, 'a').map((t) => t.id)).toEqual(['b'])
  })

  it('ignores pause and resume on the wrong state', () => {
    const state = startTimer([], base, 1_000, 0)
    expect(pauseTimer(pauseTimer(state, 'a', 500), 'a', 600)[0].remaining).toBe(500)
    expect(resumeTimer(state, 'a', 500)).toEqual(state)
  })
})

describe('formatClock', () => {
  it('shows mm:ss, rounds up, and switches to h:mm:ss from one hour', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(754_000)).toBe('12:34')
    expect(formatClock(3_600_000)).toBe('1:00:00')
    expect(formatClock(-5)).toBe('00:00')
  })
})

describe('storage', () => {
  it('round-trips through localStorage-like storage', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
    const state = pauseTimer(startTimer([], base, 60_000, 0), 'a', 10_000)
    saveTimers(storage, state)
    expect(data.has(TIMERS_STORAGE_KEY)).toBe(true)
    expect(loadTimers(storage)).toEqual(state)

    saveTimers(storage, [])
    expect(data.has(TIMERS_STORAGE_KEY)).toBe(false)
  })

  it('treats corrupt or partial stored data as no timers, never throws', () => {
    expect(parseTimers(null)).toEqual([])
    expect(parseTimers('not json')).toEqual([])
    expect(parseTimers('{"id":"x"}')).toEqual([])
    expect(parseTimers('[{"id":"a","name":"x","addMin":7,"endsAt":1,"remaining":null}]')).toEqual([])
    expect(parseTimers('[{"id":"a","name":"x","addMin":5,"endsAt":null,"remaining":null}]')).toEqual([])
  })

  it('survives blocked or throwing storage', () => {
    const throwing = {
      getItem: vi.fn(() => {
        throw new Error('denied')
      }),
      setItem: vi.fn(() => {
        throw new Error('quota')
      }),
      removeItem: vi.fn(() => {
        throw new Error('denied')
      }),
    }
    expect(loadTimers(throwing)).toEqual([])
    expect(() => saveTimers(throwing, [startTimer([], base, 1_000, 0)[0] as RecipeTimer])).not.toThrow()
    expect(() => saveTimers(throwing, [])).not.toThrow()
    expect(loadTimers(null)).toEqual([])
  })
})
