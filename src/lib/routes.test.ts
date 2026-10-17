import { describe, it, expect } from 'vitest'
import { categoryPath, recipePath, isPublicRoute, RECIPE_PAGE_RE, PRZEPIS_PAGE_RE, legacyRecipePathToCanonical } from './routes'

describe('recipePath', () => {
  it('builds the canonical /przepis/{slug} path', () => {
    expect(recipePath('tiramisu')).toBe('/przepis/tiramisu')
  })

  it('encodes the slug once, so an unexpected char never breaks the path', () => {
    expect(recipePath('a b?c')).toBe('/przepis/a%20b%3Fc')
    expect(recipePath('a/b')).toBe('/przepis/a%2Fb')
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

  it('keeps the owner list and everything else gated', () => {
    expect(isPublicRoute('/recipes')).toBe(false)
    expect(isPublicRoute('/przepis')).toBe(false)
    expect(isPublicRoute('/settings')).toBe(false)
    expect(isPublicRoute('/ulubione')).toBe(false)
  })
})
