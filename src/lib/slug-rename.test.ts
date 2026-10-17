import { describe, it, expect } from 'vitest'
import { buildSlugRenames, type SlugRow } from './slug-rename'

let nextId = 1
function row(over: Partial<SlugRow> & { slug: string }): SlugRow {
  const id = over.id ?? nextId++
  return { id, created_at: `2026-01-${String(id).padStart(2, '0')}T00:00:00Z`, ...over }
}

describe('buildSlugRenames — the slug global-unique backfill rule (E01-S03b migration A)', () => {
  it('is a no-op when every slug is already unique', () => {
    const rows = [row({ id: 1, slug: 'tiramisu' }), row({ id: 2, slug: 'paella' })]
    expect(buildSlugRenames(rows)).toEqual([])
  })

  it('keeps the oldest row on the bare slug and suffixes the rest', () => {
    const rows = [
      row({ id: 1, slug: 'placki', created_at: '2026-01-02T00:00:00Z' }),
      row({ id: 2, slug: 'placki', created_at: '2026-01-01T00:00:00Z' }), // oldest
      row({ id: 3, slug: 'placki', created_at: '2026-01-03T00:00:00Z' }),
    ]
    // id 2 is oldest → keeps "placki"; the others get the lowest free suffixes.
    expect(buildSlugRenames(rows)).toEqual([
      { id: 1, oldSlug: 'placki', newSlug: 'placki-2' },
      { id: 3, oldSlug: 'placki', newSlug: 'placki-3' },
    ])
  })

  it('breaks a created_at tie by id (lowest id is oldest)', () => {
    const rows = [
      row({ id: 5, slug: 'sernik', created_at: '2026-01-01T00:00:00Z' }),
      row({ id: 3, slug: 'sernik', created_at: '2026-01-01T00:00:00Z' }), // same time, lower id → keeps bare
    ]
    expect(buildSlugRenames(rows)).toEqual([{ id: 5, oldSlug: 'sernik', newSlug: 'sernik-2' }])
  })

  it('skips a suffix already taken by an unrelated row', () => {
    const rows = [
      row({ id: 1, slug: 'tort', created_at: '2026-01-01T00:00:00Z' }), // keeps "tort"
      row({ id: 2, slug: 'tort', created_at: '2026-01-02T00:00:00Z' }), // wants "tort-2"
      row({ id: 3, slug: 'tort-2', created_at: '2026-01-03T00:00:00Z' }), // but a real "tort-2" exists
    ]
    // id 2 must jump to "tort-3"; the real "tort-2" (id 3) is unique and untouched.
    expect(buildSlugRenames(rows)).toEqual([{ id: 2, oldSlug: 'tort', newSlug: 'tort-3' }])
  })

  it('handles several colliding slugs independently', () => {
    const rows = [
      row({ id: 1, slug: 'a', created_at: '2026-01-01T00:00:00Z' }),
      row({ id: 2, slug: 'a', created_at: '2026-01-02T00:00:00Z' }),
      row({ id: 3, slug: 'b', created_at: '2026-01-01T00:00:00Z' }),
      row({ id: 4, slug: 'b', created_at: '2026-01-02T00:00:00Z' }),
    ]
    expect(buildSlugRenames(rows)).toEqual([
      { id: 2, oldSlug: 'a', newSlug: 'a-2' },
      { id: 4, oldSlug: 'b', newSlug: 'b-2' },
    ])
  })
})
