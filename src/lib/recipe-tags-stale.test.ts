import { describe, it, expect } from 'vitest'
import { staleTagsFor } from '@/lib/recipe-tags'

const base = { title: 'Zwykły przepis', prepTimeMinutes: null, cookTimeMinutes: null, totalTimeMinutes: null }

describe('staleTagsFor', () => {
  it('adds the title-pattern tag to a tagless recipe (tags = [])', () => {
    expect(staleTagsFor({ ...base, title: 'Ciasteczka kokosowe', tags: [] })).toEqual(['kokosowe'])
  })

  it('treats null tags the same as an empty list', () => {
    expect(staleTagsFor({ ...base, title: 'Orzechowiec', tags: null })).toEqual(['orzechowe'])
  })

  it('returns nothing for a recipe that already has a tag (add-only)', () => {
    expect(staleTagsFor({ ...base, title: 'Ciasteczka kokosowe', tags: ['grill'] })).toEqual([])
  })

  it('returns nothing when no deterministic rule matches (stays tagless)', () => {
    expect(staleTagsFor({ ...base, title: 'Zupa pomidorowa', tags: [] })).toEqual([])
  })

  it('adds szybkie from the stored times when the title matches nothing', () => {
    expect(
      staleTagsFor({ ...base, title: 'Jajecznica', tags: [], prepTimeMinutes: 5, cookTimeMinutes: 5 }),
    ).toEqual(['szybkie'])
  })

  it('combines title tags and szybkie, never taking LLM-only tags', () => {
    const tags = staleTagsFor({ ...base, title: 'Sernik na zimno', tags: [], totalTimeMinutes: 20 })
    expect(tags).toEqual(expect.arrayContaining(['z-twarogiem', 'na-zimno', 'szybkie']))
  })

  it('does not add szybkie when the times are unknown', () => {
    expect(staleTagsFor({ ...base, title: 'Jajecznica', tags: [] })).toEqual([])
  })
})
