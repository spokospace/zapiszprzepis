import { beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/track', () => ({ track }))

// No DOM here: collect the effect of each "mount" and keep its ref across effect re-runs.
const hooks = vi.hoisted(() => ({ ref: { current: false }, effects: [] as (() => void)[] }))
vi.mock('react', () => ({
  useRef: () => hooks.ref,
  useEffect: (fn: () => void) => void hooks.effects.push(fn),
}))

import { TrackView } from './track-view'

function mount() {
  hooks.ref = { current: false }
  hooks.effects = []
  return TrackView({ event: 'recipe_view', subject: 'zupa-krem' })
}

beforeEach(() => track.mockClear())

describe('TrackView', () => {
  it('renders nothing', () => {
    expect(mount()).toBeNull()
  })

  it('fires its event once per mount, even if the effect runs twice (Strict Mode)', () => {
    mount()
    hooks.effects[0]()
    hooks.effects[0]()
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('recipe_view', 'zupa-krem')
  })

  it('fires again for a new mount', () => {
    mount()
    hooks.effects[0]()
    mount()
    hooks.effects[0]()
    expect(track).toHaveBeenCalledTimes(2)
  })
})
