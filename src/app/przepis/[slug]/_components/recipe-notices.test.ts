import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/browser-session', () => ({ browserSession: { sync: vi.fn() } }))

import { recipeNotices } from './recipe-notices'

const notices = (query: string) => recipeNotices(new URLSearchParams(query))

describe('recipeNotices', () => {
  it('has nothing to say on a plain link', () => {
    expect(notices('from=kategoria')).toEqual([])
  })

  it.each([
    ['duplicate=1', 'duplicate', 'info'],
    ['in_favorites=1', 'in_favorites', 'info'],
    ['refreshing=1', 'refreshing', 'success'],
    ['refresh_error=1', 'refresh_error', 'error'],
    ['refresh_error=no_access', 'refresh_error', 'error'],
    ['refresh_error=rate_limited', 'refresh_error', 'error'],
    ['refresh_error=unavailable', 'refresh_error', 'error'],
  ])('%s shows one toast that clears its own param', (query, clearParam, type) => {
    expect(notices(query)).toMatchObject([{ clearParam, type }])
  })

  it('ignores a value it does not know', () => {
    expect(notices('refresh_error=x&duplicate=2')).toEqual([])
  })
})
