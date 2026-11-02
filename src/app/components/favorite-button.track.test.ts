import { beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.hoisted(() => vi.fn())
const actions = vi.hoisted(() => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('@/lib/analytics/track', () => ({ track }))
vi.mock('@/app/favorites/actions', () => actions)

// No DOM: hooks become plain functions; state setters are no-ops, the transition runs at once.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: (initial: unknown) => [initial, vi.fn()],
  useTransition: () => [false, (fn: () => unknown) => fn()],
  useEffect: vi.fn(),
  useCallback: (fn: unknown) => fn,
}))

import { FavoriteButton } from './favorite-button'

type El = { props: { children?: El | El[]; onClick?: () => void } }

/** The heart's onClick: the first button in the rendered tree. */
function heartClick(props: Parameters<typeof FavoriteButton>[0]): () => void {
  const root = FavoriteButton(props) as unknown as El
  const kids = ([] as El[]).concat(root.props.children ?? [])
  const button = kids.find((k) => k && typeof k.props?.onClick === 'function')
  if (!button?.props.onClick) throw new Error('no heart button')
  return button.props.onClick
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  track.mockClear()
  actions.addFavorite.mockReset().mockResolvedValue({ ok: true })
  actions.removeFavorite.mockReset().mockResolvedValue({ ok: true })
})

describe('FavoriteButton usage count', () => {
  it('counts favorite_add once when a recipe is added', async () => {
    heartClick({ recipeId: 7, recipeSlug: 'sernik', initialFavorited: false, isAuthenticated: true })()
    await flush()
    expect(actions.addFavorite).toHaveBeenCalledWith(7)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('favorite_add', 'sernik')
  })

  it('never counts a removal', async () => {
    heartClick({ recipeId: 7, recipeSlug: 'sernik', initialFavorited: true, isAuthenticated: true })()
    await flush()
    expect(actions.removeFavorite).toHaveBeenCalledWith(7)
    expect(track).not.toHaveBeenCalled()
  })

  it('does not count an add the server refused', async () => {
    actions.addFavorite.mockResolvedValue({ ok: false })
    heartClick({ recipeId: 7, recipeSlug: 'sernik', initialFavorited: false, isAuthenticated: true })()
    await flush()
    expect(track).not.toHaveBeenCalled()
  })

  it('counts nothing without a slug', async () => {
    heartClick({ recipeId: 7, initialFavorited: false, isAuthenticated: true })()
    await flush()
    expect(track).not.toHaveBeenCalled()
  })
})
