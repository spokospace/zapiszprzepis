import { describe, expect, it } from 'vitest'
import { buildContentDuplicateGroups, type ContentRow } from './recipe-content-dedup'

const ing = (...names: string[]) => names.map((name) => ({ name }))

function row(partial: Partial<ContentRow> & { id: number }): ContentRow {
  return {
    user_id: 'user-1',
    title: 'Miodownik z kaszą manną',
    ingredients: ing('mąka', 'jajka', 'cukier'),
    source_author: null,
    created_at: '2026-10-16T23:00:00Z',
    ...partial,
  }
}

describe('buildContentDuplicateGroups', () => {
  it('folds a partial extraction into the fuller one under the same title', () => {
    // The real case: #749 (cake base only) is a subset of #752 (base + cream).
    const base = ing('mąka', 'jajka', 'cukier', 'miód', 'soda oczyszczona', 'margaryna lub masło')
    const full = [...base, { name: 'mleko' }, { name: 'kasza manna' }]
    const rows = [
      row({ id: 749, ingredients: base, created_at: '2026-10-16T23:03:27Z' }),
      row({ id: 752, ingredients: full, created_at: '2026-10-16T23:04:53Z' }),
    ]
    // The fuller copy (#752) is kept even though it is the newer one.
    expect(buildContentDuplicateGroups(rows, null)).toEqual([{ canonicalId: 752, loserIds: [749] }])
  })

  it('leaves two same-titled but genuinely different recipes apart', () => {
    const rows = [
      row({ id: 1, title: 'Szarlotka', ingredients: ing('mąka', 'jabłka', 'cukier', 'masło', 'cynamon') }),
      row({ id: 2, title: 'Szarlotka', ingredients: ing('mąka', 'jabłka', 'budyń', 'kwaśna śmietana', 'drożdże') }),
    ]
    expect(buildContentDuplicateGroups(rows, null)).toEqual([])
  })

  it('never groups across different titles on a subset (only on an identical set)', () => {
    const rows = [
      row({ id: 1, title: 'Makowiec', ingredients: ing('mąka', 'mak', 'cukier') }),
      row({ id: 2, title: 'Sernik', ingredients: ing('mąka', 'mak', 'cukier', 'ser') }),
    ]
    expect(buildContentDuplicateGroups(rows, null)).toEqual([])
  })

  it('groups two differently-titled recipes with the identical ingredient set (#835/#836)', () => {
    // The real case: one Facebook video the LLM titled two ways, extracted from
    // two near-simultaneous shares to the identical 8-ingredient set.
    const set = ing('masło', 'chleb', 'czarny pieprz', 'sól', 'jajka', 'oregano', 'szynka', 'ser')
    const rows = [
      row({ id: 835, title: 'Kanapki z jajkiem i szynką', ingredients: set, created_at: '2026-10-17T22:23:47Z' }),
      row({ id: 836, title: 'Zapiekanka z szynką i serem', ingredients: set, created_at: '2026-10-17T22:24:18Z' }),
    ]
    // Completeness ties (same set), so the older #835 is kept.
    expect(buildContentDuplicateGroups(rows, null)).toEqual([{ canonicalId: 835, loserIds: [836] }])
  })

  it('keeps a differently-titled set below the fingerprint floor apart', () => {
    const rows = [
      row({ id: 1, title: 'Jajecznica', ingredients: ing('jajka', 'masło', 'sól') }),
      row({ id: 2, title: 'Omlet', ingredients: ing('jajka', 'masło', 'sól') }),
    ]
    expect(buildContentDuplicateGroups(rows, null)).toEqual([])
  })

  it('keeps the preferred owner, then the oldest, when completeness ties', () => {
    const same = ing('mąka', 'jajka', 'cukier', 'masło')
    const rows = [
      row({ id: 10, user_id: 'user-2', ingredients: same, created_at: '2026-01-01T00:00:00Z' }),
      row({ id: 11, user_id: 'main', ingredients: same, created_at: '2026-02-01T00:00:00Z' }),
      row({ id: 12, user_id: 'user-3', ingredients: same, created_at: '2026-03-01T00:00:00Z' }),
    ]
    expect(buildContentDuplicateGroups(rows, 'main')).toEqual([{ canonicalId: 11, loserIds: [10, 12] }])
  })

  it('folds a same-author repost whose ingredients differ by one name (#639/#894)', () => {
    // The real pair: "Kulinarna Wiola" reposted her shortbread with the aroma
    // swapped. Same title, 3 of 4 ingredients shared, neither set a subset of
    // the other — only the near-match tier, gated on the author, links them.
    const cream = ing('masło', 'mąka pszenna', 'cukier puder', 'aromat śmietankowy')
    const vanilla = ing('masło', 'mąka pszenna', 'cukier puder', 'aromat waniliowy')
    const rows = [
      row({ id: 639, title: 'Kruche ciasteczka', ingredients: cream, source_author: 'Kulinarna Wiola', created_at: '2026-10-16T22:30:48Z' }),
      row({ id: 894, title: 'Kruche ciasteczka', ingredients: vanilla, source_author: 'Kulinarna Wiola', created_at: '2026-10-17T23:18:34Z' }),
    ]
    // Completeness ties (4 names each), so the older #639 is kept.
    expect(buildContentDuplicateGroups(rows, null)).toEqual([{ canonicalId: 639, loserIds: [894] }])
  })

  it('leaves the same near-match apart when the authors differ', () => {
    const cream = ing('masło', 'mąka pszenna', 'cukier puder', 'aromat śmietankowy')
    const vanilla = ing('masło', 'mąka pszenna', 'cukier puder', 'aromat waniliowy')
    const rows = [
      row({ id: 1, title: 'Kruche ciasteczka', ingredients: cream, source_author: 'Kulinarna Wiola' }),
      row({ id: 2, title: 'Kruche ciasteczka', ingredients: vanilla, source_author: 'Inny Autor' }),
    ]
    expect(buildContentDuplicateGroups(rows, null)).toEqual([])
  })

  it('leaves a near-match apart when neither copy names an author (blogs)', () => {
    const cream = ing('masło', 'mąka pszenna', 'cukier puder', 'aromat śmietankowy')
    const vanilla = ing('masło', 'mąka pszenna', 'cukier puder', 'aromat waniliowy')
    const rows = [
      row({ id: 1, title: 'Kruche ciasteczka', ingredients: cream, source_author: null }),
      row({ id: 2, title: 'Kruche ciasteczka', ingredients: vanilla, source_author: null }),
    ]
    expect(buildContentDuplicateGroups(rows, null)).toEqual([])
  })

  it('merges a chain transitively through the fullest copy', () => {
    const rows = [
      row({ id: 1, ingredients: ing('mąka', 'jajka', 'cukier') }),
      row({ id: 2, ingredients: ing('mąka', 'jajka', 'cukier', 'miód') }),
      row({ id: 3, ingredients: ing('mąka', 'jajka', 'cukier', 'miód', 'soda') }),
    ]
    expect(buildContentDuplicateGroups(rows, null)).toEqual([{ canonicalId: 3, loserIds: [1, 2] }])
  })
})
