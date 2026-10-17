import { describe, it, expect } from 'vitest'
import {
  categoryPath,
  recipePath,
  profilePath,
  isPublicRoute,
  RECIPE_PAGE_RE,
  PRZEPIS_PAGE_RE,
  legacyRecipePathToCanonical,
  searchPath,
  SEARCH_PATH,
} from './routes'

describe('recipePath', () => {
  it('builds the canonical /przepis/{slug} path', () => {
    expect(recipePath('tiramisu')).toBe('/przepis/tiramisu')
  })

  it('encodes the slug once, so an unexpected char never breaks the path', () => {
    expect(recipePath('a b?c')).toBe('/przepis/a%20b%3Fc')
    expect(recipePath('a/b')).toBe('/przepis/a%2Fb')
  })

  it('appends the list context only when one is given (E01-S07)', () => {
    expect(recipePath('tiramisu', { from: 'fav' })).toBe('/przepis/tiramisu?from=fav')
    expect(recipePath('tiramisu', { from: null })).toBe('/przepis/tiramisu')
    expect(recipePath('tiramisu', {})).toBe('/przepis/tiramisu')
  })
})

describe('profilePath', () => {
  it('links /u/{username} once E01-S14 ships the page', () => {
    expect(profilePath('ania')).toBe('/u/ania')
    expect(isPublicRoute(profilePath('ania')!)).toBe(true)
  })

  it('is null without a username, so a missing author renders as plain text', () => {
    expect(profilePath(null)).toBeNull()
    expect(profilePath(undefined)).toBeNull()
    expect(profilePath('')).toBeNull()
  })
})

describe('legacyRecipePathToCanonical', () => {
  it('swaps the /recipes/ prefix for /przepis/', () => {
    expect(legacyRecipePathToCanonical('/recipes/tiramisu')).toBe('/przepis/tiramisu')
  })

  it('keeps the slug segment verbatim — already-encoded chars are not re-encoded', () => {
    expect(legacyRecipePathToCanonical('/recipes/a%20b')).toBe('/przepis/a%20b')
  })
})

describe('PRZEPIS_PAGE_RE', () => {
  it('matches a single-segment /przepis/{slug}', () => {
    expect(PRZEPIS_PAGE_RE.test('/przepis/tiramisu')).toBe(true)
  })

  it('rejects the bare prefix and deeper paths', () => {
    expect(PRZEPIS_PAGE_RE.test('/przepis')).toBe(false)
    expect(PRZEPIS_PAGE_RE.test('/przepis/')).toBe(false)
    expect(PRZEPIS_PAGE_RE.test('/przepis/tiramisu/edit')).toBe(false)
  })
})

describe('RECIPE_PAGE_RE (legacy, kept for the 301)', () => {
  it('matches a single-segment /recipes/{slug}', () => {
    expect(RECIPE_PAGE_RE.test('/recipes/tiramisu')).toBe(true)
  })

  it('does not match the owner list or deeper paths', () => {
    expect(RECIPE_PAGE_RE.test('/recipes')).toBe(false)
    expect(RECIPE_PAGE_RE.test('/recipes/')).toBe(false)
    expect(RECIPE_PAGE_RE.test('/recipes/tiramisu/edit')).toBe(false)
  })
})

describe('isPublicRoute', () => {
  it('allows the home, the canonical recipe page, and the legacy recipe page', () => {
    expect(isPublicRoute('/')).toBe(true)
    expect(isPublicRoute('/przepis/tiramisu')).toBe(true)
    // kept public so middleware can 301 it instead of bouncing to /login
    expect(isPublicRoute('/recipes/tiramisu')).toBe(true)
  })

  it('allows the category listing categoryPath builds (E01-S09)', () => {
    expect(categoryPath('sniadania')).toBe('/przepisy/sniadania')
    expect(isPublicRoute(categoryPath('sniadania'))).toBe(true)
    // the bare listing root and deeper paths stay gated
    expect(isPublicRoute('/przepisy')).toBe(false)
    expect(isPublicRoute('/przepisy/zupy/x')).toBe(false)
  })

  it('allows a public profile /u/{username} (E01-S14)', () => {
    expect(isPublicRoute('/u/tola')).toBe(true)
    expect(isPublicRoute('/u')).toBe(false)
    expect(isPublicRoute('/u/tola/x')).toBe(false)
  })

  it('adds tag and page filters to the category listing (E01-S16)', () => {
    expect(categoryPath('ciasta', { tags: ['kruche', 'czekoladowe'] })).toBe('/przepisy/ciasta?tag=kruche,czekoladowe')
    expect(categoryPath('ciasta', { tags: ['kruche'], page: 2 })).toBe('/przepisy/ciasta?tag=kruche&strona=2')
    expect(categoryPath('ciasta', { tags: [], page: 1 })).toBe('/przepisy/ciasta')
    expect(categoryPath('ciasta', { page: 3 })).toBe('/przepisy/ciasta?strona=3')
  })

  it('keeps the owner list and everything else gated', () => {
    expect(isPublicRoute('/recipes')).toBe(false)
    expect(isPublicRoute('/przepis')).toBe(false)
    expect(isPublicRoute('/settings')).toBe(false)
    expect(isPublicRoute('/ulubione')).toBe(false)
  })
})

describe('searchPath', () => {
  it('points at the public results page (E01-S05)', () => {
    expect(SEARCH_PATH).toBe('/szukaj')
    expect(isPublicRoute('/szukaj')).toBe(true)
  })

  it('trims and encodes the query', () => {
    expect(searchPath('  zupa pomidorowa ')).toBe('/szukaj?q=zupa+pomidorowa')
    expect(searchPath('a&b')).toBe('/szukaj?q=a%26b')
  })

  it('drops a blank query', () => {
    expect(searchPath('   ')).toBe('/szukaj')
  })

  it('leaves out the default scope and the first page', () => {
    expect(searchPath('sernik', 'wszystkie', 1)).toBe('/szukaj?q=sernik')
    expect(searchPath('sernik', 'moje')).toBe('/szukaj?q=sernik&zakres=moje')
    expect(searchPath('sernik', 'ulubione', 3)).toBe('/szukaj?q=sernik&zakres=ulubione&strona=3')
  })

  it('keeps the scope on a cleared search', () => {
    expect(searchPath('', 'moje')).toBe('/szukaj?zakres=moje')
  })
})
