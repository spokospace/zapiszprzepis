import { beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.hoisted(() => vi.fn())
const actions = vi.hoisted(() => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }))
vi.mock('@/lib/analytics/track', () => ({ track }))
vi.mock('@/app/favorites/actions', () => actions)
vi.mock('@/lib/browser-session', () => ({ browserSession: { sync: vi.fn() } }))

const effects = vi.hoisted(() => [] as (() => void)[])
vi.mock('@/lib/strip-search-param', () => ({ stripSearchParam: vi.fn() }))

// No DOM: hooks become plain functions; state setters are no-ops, the transition runs at once.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: (initial: unknown) => [initial, vi.fn()],
  useTransition: () => [false, (fn: () => unknown) => fn()],
  useEffect: (fn: () => void) => void effects.push(fn),
  useCallback: (fn: unknown) => fn,
}))

import { FavoriteAddedNotice, FavoriteButton } from './favorite-button'

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
  effects.length = 0
  vi.unstubAllGlobals()
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

describe("FavoriteButton usage count after a guest heart's login", () => {
  const arrive = (search: string, props: Parameters<typeof FavoriteButton>[0]) => {
    vi.stubGlobal('window', { location: { search } })
    FavoriteButton(props)
    effects.forEach((run) => run())
  }

  it('counts the add once when the page is claimed via ?fav_added=', () => {
    arrive('?fav_added=7', { recipeId: 7, recipeSlug: 'sernik', initialFavorited: true, isAuthenticated: true })
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('favorite_add', 'sernik')
  })

  it('counts nothing for another recipe or without the param', () => {
    arrive('?fav_added=8', { recipeId: 7, recipeSlug: 'sernik', initialFavorited: false, isAuthenticated: true })
    arrive('', { recipeId: 7, recipeSlug: 'sernik', initialFavorited: false, isAuthenticated: true })
    expect(track).not.toHaveBeenCalled()
  })

  it('counts via the home notice, which gets the slug from the page', () => {
    vi.stubGlobal('window', { location: { search: '?fav_added=7' } })
    FavoriteAddedNotice({ recipeId: 7, recipeSlug: 'sernik' })
    effects.forEach((run) => run())
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('favorite_add', 'sernik')
  })
})
