import { beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/track', () => ({ track }))

// No DOM: hooks become plain functions so the provider can be called and its `start` read.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useSyncExternalStore: () => [],
  useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, vi.fn()],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: vi.fn(),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
}))

import { TimerProvider, type NewTimer } from './timer-provider'

type Value = { start: (timer: NewTimer, minutes: number) => void }

function start(timer: NewTimer, minutes = 10) {
  const provider = TimerProvider({ children: null }) as unknown as { props: { value: Value } }
  provider.props.value.start(timer, minutes)
}

const TIMER: NewTimer = { name: 'Sernik', recipeSlug: 'sernik', recipeTitle: 'Sernik', step: 2, next: null, addMin: 5 }

beforeEach(() => {
  track.mockClear()
  vi.stubGlobal('window', {})
})

describe('timer start usage count', () => {
  it('counts timer_start once per started timer, under the recipe slug', () => {
    start(TIMER)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('timer_start', 'sernik')
    start(TIMER)
    expect(track).toHaveBeenCalledTimes(2)
  })

  it('counts nothing for a free-standing timer (no recipe slug)', () => {
    start({ ...TIMER, recipeSlug: null })
    expect(track).not.toHaveBeenCalled()
  })
})
