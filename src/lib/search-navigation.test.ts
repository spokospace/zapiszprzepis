import { describe, expect, it } from 'vitest'
import { searchNavigation } from './search-navigation'

describe('searchNavigation', () => {
  it('pushes when a search starts', () => {
    expect(searchNavigation('', 'zupa')).toEqual({ href: '/recipes?q=zupa', replace: false })
  })

  it('replaces while the search is refined, so Back skips partial queries', () => {
    expect(searchNavigation('?q=sa', 'sałatka')).toEqual({ href: '/recipes?q=sa%C5%82atka', replace: true })
  })

  it('replaces when the search is cleared, dropping q', () => {
    expect(searchNavigation('?q=zupa', '')).toEqual({ href: '/recipes', replace: true })
  })

  it('keeps the category and tag filters', () => {
    expect(searchNavigation('?category=zupy&tag=wege', 'pomidor')).toEqual({
      href: '/recipes?category=zupy&tag=wege&q=pomidor',
      replace: false,
    })
    expect(searchNavigation('?category=zupy&q=pomidor', '  ')).toEqual({ href: '/recipes?category=zupy', replace: true })
  })

  it('trims the query', () => {
    expect(searchNavigation('', '  zupa ')).toEqual({ href: '/recipes?q=zupa', replace: false })
  })

  it('does nothing when the query would not change', () => {
    expect(searchNavigation('', '   ')).toBeNull()
    expect(searchNavigation('?q=zupa', ' zupa ')).toBeNull()
  })
})
