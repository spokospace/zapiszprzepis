import { describe, it, expect } from 'vitest'
import { looksUnextractable, isExtractedRecipeUsable } from '@/lib/content-quality'

// Risk 2 — "Extraction 'succeeds' but stores junk". looksUnextractable is the
// input-side gate. These tests lock the cases it correctly rejects, and
// characterize the known cases it MISSES (pinned limitations, not fixed here).

describe('looksUnextractable — rejects junk (regression lock)', () => {
  it('rejects empty / whitespace-only content', () => {
    expect(looksUnextractable('')).toBe(true)
    expect(looksUnextractable('     \n\t  ')).toBe(true)
  })

  it('rejects content under the 150-char floor', () => {
    expect(looksUnextractable('Krótki tekst bez przepisu.')).toBe(true)
  })

  it('strips HTML before measuring length, so tag chrome does not inflate it', () => {
    const htmlChrome = `<div class="${'x'.repeat(400)}"><span>hi</span></div>`
    expect(looksUnextractable(htmlChrome)).toBe(true)
  })

  it('rejects short-ish content carrying a known junk signature', () => {
    const gt = `Rate this translation. ${'filler '.repeat(30)}` // ~210 chars, < 500
    expect(gt.length).toBeGreaterThanOrEqual(150)
    expect(gt.length).toBeLessThan(500)
    expect(looksUnextractable(gt)).toBe(true)

    const skip = `Skip to main content ${'pad '.repeat(40)}`
    expect(looksUnextractable(skip)).toBe(true)

    const plSkip = `Przejdź do głównej zawartości ${'wypełniacz '.repeat(20)}`
    expect(looksUnextractable(plSkip)).toBe(true)
  })
})

describe('looksUnextractable — known MISSES (pinned, not fixed in this phase)', () => {
  it('PINNED: a Google-Translate signature in >=500 chars slips through (gated on < 500)', () => {
    const longGt = `Rate this translation. ${'a'.repeat(600)}`
    expect(longGt.length).toBeGreaterThanOrEqual(500)
    // Documents the gap: verbose GT interstitials are NOT caught.
    expect(looksUnextractable(longGt)).toBe(false)
  })

  it('PINNED: a long non-recipe page (>=150 chars, no signature) passes the gate', () => {
    const prose = 'Lorem ipsum dolor sit amet. '.repeat(20) // ~560 chars, no signature
    expect(looksUnextractable(prose)).toBe(false)
  })

  it('PINNED: Polish GT marker not in the signature list passes', () => {
    const plGt = `Oceń to tłumaczenie ${'tekst '.repeat(25)}` // not in JUNK_SIGNATURES
    expect(plGt.length).toBeLessThan(500)
    expect(looksUnextractable(plGt)).toBe(false)
  })
})

describe('isExtractedRecipeUsable — output-side gate (Risk 2)', () => {
  const ok = {
    title: 'Naleśniki',
    ingredients: [{ name: 'Mąka' }],
    steps: ['Wymieszaj'],
  }

  it('accepts a recipe with title + non-empty ingredients + non-empty steps', () => {
    expect(isExtractedRecipeUsable(ok)).toBe(true)
  })

  it('rejects a missing / empty / non-string title', () => {
    expect(isExtractedRecipeUsable({ ...ok, title: '' })).toBe(false)
    expect(isExtractedRecipeUsable({ ...ok, title: '   ' })).toBe(false)
    expect(isExtractedRecipeUsable({ ...ok, title: undefined })).toBe(false)
    expect(isExtractedRecipeUsable({ ...ok, title: 123 })).toBe(false)
  })

  it('rejects empty or non-array ingredients (the body-less recipe)', () => {
    expect(isExtractedRecipeUsable({ ...ok, ingredients: [] })).toBe(false)
    expect(isExtractedRecipeUsable({ ...ok, ingredients: undefined })).toBe(false)
    expect(isExtractedRecipeUsable({ ...ok, ingredients: 'Mąka' })).toBe(false)
  })

  it('rejects empty or non-array steps', () => {
    expect(isExtractedRecipeUsable({ ...ok, steps: [] })).toBe(false)
    expect(isExtractedRecipeUsable({ ...ok, steps: undefined })).toBe(false)
  })
})
