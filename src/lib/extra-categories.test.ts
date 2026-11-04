import { describe, expect, it, vi } from 'vitest'
import { classifyExtraCategories, EXTRA_CATEGORIES_RULE, pickPrecisionSample, toExtraCategories } from './extra-categories'

describe('toExtraCategories', () => {
  it('accepts values and labels in any casing and keeps the order', () => {
    expect(toExtraCategories(['Śniadania', 'salatki'], 'przekaski')).toEqual(['sniadania', 'salatki'])
  })

  it('drops the primary, "inne", unknown values, non-strings and repeats', () => {
    expect(toExtraCategories(['przekaski', 'inne', 'kolacje', 7, null, 'sniadania', 'Śniadania'], 'przekaski')).toEqual(['sniadania'])
  })

  it('caps the list at two (over-assignment guard)', () => {
    expect(toExtraCategories(['zupy', 'obiady', 'desery', 'ciasta'], 'przekaski')).toEqual(['zupy', 'obiady'])
  })

  it('is empty for anything that is not a list', () => {
    expect(toExtraCategories(undefined, 'zupy')).toEqual([])
    expect(toExtraCategories('sniadania', 'zupy')).toEqual([])
    expect(toExtraCategories({ 0: 'sniadania' }, 'zupy')).toEqual([])
  })
})

describe('EXTRA_CATEGORIES_RULE', () => {
  it('makes "none" the default and names the cap', () => {
    expect(EXTRA_CATEGORIES_RULE).toMatch(/return \[\] unless/)
    expect(EXTRA_CATEGORIES_RULE).toMatch(/0–2/)
  })
})

describe('classifyExtraCategories', () => {
  const reply = (content: unknown) =>
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) })
  const recipe = { title: 'Kanapki z jajkiem', category: 'przekaski', ingredients: [], steps: [] }

  it('returns the cleaned list and never the primary', async () => {
    const fetch = reply({ extra_categories: ['przekaski', 'sniadania'] })
    expect(await classifyExtraCategories(recipe, { fetch, apiKey: 'k' })).toEqual(['sniadania'])
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('must not change')
  })

  it('is empty for an unreadable answer and throws when the call fails', async () => {
    expect(await classifyExtraCategories(recipe, { fetch: reply({ nope: 1 }), apiKey: 'k' })).toEqual([])
    const failing = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(classifyExtraCategories(recipe, { fetch: failing, apiKey: 'k' })).rejects.toThrow('OpenAI 500')
  })
})

describe('pickPrecisionSample', () => {
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, category: 'przekaski' })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: 200 + i, category: 'zupy' })),
    { id: 300, category: 'napoje' },
  ]

  it('spreads the sample over the categories, largest first, deterministically', () => {
    const sample = pickPrecisionSample(rows, 6)
    expect(sample.map((r) => r.id)).toEqual([100, 200, 300, 101, 201, 102])
    expect(pickPrecisionSample([...rows].reverse(), 6)).toEqual(sample)
  })

  it('returns everything when the pool is smaller than the size', () => {
    expect(pickPrecisionSample(rows, 50)).toHaveLength(15)
  })
})
