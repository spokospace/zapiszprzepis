import { beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.hoisted(() => vi.fn())
const session = vi.hoisted(() => ({
  current: { status: 'user', userId: 'u1', favoriteIds: new Set<number>() } as Record<string, unknown>,
  setFavorite: vi.fn(),
  sync: vi.fn(),
}))
vi.mock('@/lib/analytics/track', () => ({ track }))
vi.mock('@/lib/browser-session', () => ({
  browserSession: { setFavorite: session.setFavorite, sync: session.sync, getSnapshot: () => session.current },
  useBrowserSession: () => session.current,
}))

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
const signedIn = (favorites: number[] = []) => {
  session.current = { status: 'user', userId: 'u1', favoriteIds: new Set(favorites) }
}

beforeEach(() => {
  effects.length = 0
  vi.unstubAllGlobals()
  track.mockClear()
  signedIn()
  session.sync.mockReset().mockResolvedValue(undefined)
  session.setFavorite.mockReset().mockResolvedValue({ ok: true })
})

describe('FavoriteButton usage count', () => {
  it('counts favorite_add once when a recipe is added', async () => {
    heartClick({ recipeId: 7, recipeSlug: 'sernik' })()
    await flush()
    expect(session.setFavorite).toHaveBeenCalledWith(7, true)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('favorite_add', 'sernik')
  })

  it('never counts a removal', async () => {
    signedIn([7])
    heartClick({ recipeId: 7, recipeSlug: 'sernik' })()
    await flush()
    expect(session.setFavorite).toHaveBeenCalledWith(7, false)
    expect(track).not.toHaveBeenCalled()
  })

  it('does not count an add that failed', async () => {
    session.setFavorite.mockResolvedValue({ ok: false, error: 'failed' })
    heartClick({ recipeId: 7, recipeSlug: 'sernik' })()
    await flush()
    expect(track).not.toHaveBeenCalled()
  })

  it('counts nothing without a slug', async () => {
    heartClick({ recipeId: 7 })()
    await flush()
    expect(track).not.toHaveBeenCalled()
  })
})

describe('FavoriteButton click before and without a session', () => {
  const stubLocation = () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign, pathname: '/przepis/sernik', search: '' } })
    return assign
  }

  it('sends a guest to log in, carrying the recipe', async () => {
    session.current = { status: 'guest' }
    const assign = stubLocation()
    heartClick({ recipeId: 7 })()
    await flush()
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign.mock.calls[0][0]).toContain('fav=7')
    expect(session.setFavorite).not.toHaveBeenCalled()
  })

  it('reads the session first, so an early tap of a signed-in reader saves instead of opening login', async () => {
    session.current = { status: 'unknown' }
    session.sync.mockImplementation(async () => signedIn())
    const assign = stubLocation()
    heartClick({ recipeId: 7 })()
    await flush()
    expect(assign).not.toHaveBeenCalled()
    expect(session.setFavorite).toHaveBeenCalledWith(7, true)
  })

  it('removes a listed favorite when the browser has not read the favorites yet', async () => {
    session.current = { status: 'user', userId: 'u1' }
    heartClick({ recipeId: 7, initialFavorited: true })()
    await flush()
    expect(session.setFavorite).toHaveBeenCalledWith(7, false)
  })
})

describe("FavoriteButton usage count after a guest heart's login", () => {
  const arrive = (search: string, props: Parameters<typeof FavoriteButton>[0]) => {
    vi.stubGlobal('window', { location: { search } })
    FavoriteButton(props)
    effects.forEach((run) => run())
  }

  it('counts the add once when the page is claimed via ?fav_added=', () => {
    arrive('?fav_added=7', { recipeId: 7, recipeSlug: 'sernik' })
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('favorite_add', 'sernik')
  })

  it('counts nothing for another recipe or without the param', () => {
    arrive('?fav_added=8', { recipeId: 7, recipeSlug: 'sernik' })
    arrive('', { recipeId: 7, recipeSlug: 'sernik' })
    expect(track).not.toHaveBeenCalled()
  })

  it('leaves the home notice uncounted: it shows for a recipe no row holds, so an old favorite', () => {
    vi.stubGlobal('window', { location: { search: '?fav_added=7' } })
    FavoriteAddedNotice({ recipeId: 7 })
    effects.forEach((run) => run())
    expect(track).not.toHaveBeenCalled()
  })
})
