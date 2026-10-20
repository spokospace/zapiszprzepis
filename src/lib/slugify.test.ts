import { describe, it, expect } from 'vitest'
import { FALLBACK_RECIPE_SLUG, NUMBERED_SLUG_ATTEMPTS, recipeSlug, recipeSlugCandidate, slugify } from './slugify'

describe('slugify', () => {
  it('turns a Polish title into an ASCII slug', () => {
    expect(slugify('Sernik z rosą')).toBe('sernik-z-rosa')
  })

  it('leaves nothing when the title has no Latin letters or digits', () => {
    expect(slugify('🍰🍓')).toBe('')
  })
})

describe('recipeSlug', () => {
  it('keeps the slug of a title that already slugifies', () => {
    expect(recipeSlug('Naleśniki')).toBe('nalesniki')
  })

  it('falls back to a non-empty slug when the title slugifies to nothing', () => {
    expect(recipeSlug('🍰🍓')).toBe(FALLBACK_RECIPE_SLUG)
    expect(recipeSlug('  — ')).toBe(FALLBACK_RECIPE_SLUG)
  })
})

describe('recipeSlugCandidate', () => {
  it('tries the bare slug, then -2 … -10', () => {
    const slugs = Array.from({ length: NUMBERED_SLUG_ATTEMPTS }, (_, i) => recipeSlugCandidate('sernik', i + 1))
    expect(slugs).toEqual([
      'sernik', 'sernik-2', 'sernik-3', 'sernik-4', 'sernik-5',
      'sernik-6', 'sernik-7', 'sernik-8', 'sernik-9', 'sernik-10',
    ])
  })

  it('switches to a random suffix past the numbered attempts', () => {
    const slug = recipeSlugCandidate('sernik', NUMBERED_SLUG_ATTEMPTS + 1)
    expect(slug).toMatch(/^sernik-[a-z0-9]{8}$/)
    expect(slug).not.toBe(`sernik-${NUMBERED_SLUG_ATTEMPTS + 1}`)
  })

  it('gives a different random suffix on each attempt', () => {
    const slugs = new Set(Array.from({ length: 20 }, () => recipeSlugCandidate('sernik', NUMBERED_SLUG_ATTEMPTS + 1)))
    expect(slugs.size).toBeGreaterThan(1)
  })
})
