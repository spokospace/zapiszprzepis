import { describe, it, expect } from 'vitest'
import { buildCollapseGroups, type CollapseRow } from './recipe-collapse'

const MAIN = 'user-5'

let nextId = 1
function row(over: Partial<CollapseRow> & { user_id: string }): CollapseRow {
  const id = over.id ?? nextId++
  return { id, source_url: null, source_fingerprint: null, created_at: `2026-01-${String(id).padStart(2, '0')}T00:00:00Z`, ...over }
}

describe('buildCollapseGroups — which rows are one recipe', () => {
  it('groups rows saved under the same link', () => {
    const rows = [
      row({ id: 1, user_id: 'user-4', source_url: 'https://a.example/tiramisu' }),
      row({ id: 2, user_id: 'user-3', source_url: 'https://a.example/tiramisu' }),
      row({ id: 3, user_id: 'user-4', source_url: 'https://a.example/paella' }),
    ]

    expect(buildCollapseGroups(rows, null)).toEqual([{ canonicalId: 1, loserIds: [2] }])
  })

  it('groups one Facebook group post saved under its group name and its number', () => {
    const rows = [
      row({ id: 1, user_id: 'user-4', source_url: 'https://www.facebook.com/groups/kuchnia/posts/123' }),
      row({ id: 2, user_id: 'user-3', source_url: 'https://www.facebook.com/groups/998877/posts/123' }),
      row({ id: 3, user_id: 'user-3', source_url: 'https://www.facebook.com/groups/kuchnia/posts/456' }),
    ]

    expect(buildCollapseGroups(rows, null)).toEqual([{ canonicalId: 1, loserIds: [2] }])
  })

  it('groups the same author text saved from two different links', () => {
    const rows = [
      row({ id: 1, user_id: 'user-4', source_url: 'https://fb.example/p/1', source_fingerprint: 'f1' }),
      row({ id: 2, user_id: 'user-3', source_url: 'https://fb.example/p/2', source_fingerprint: 'f1' }),
    ]

    expect(buildCollapseGroups(rows, null)).toEqual([{ canonicalId: 1, loserIds: [2] }])
  })

  it('joins groups transitively through a link and a fingerprint', () => {
    const rows = [
      row({ id: 1, user_id: 'user-4', source_url: 'https://x.example/a', source_fingerprint: 'f1' }),
      row({ id: 2, user_id: 'user-3', source_url: 'https://x.example/b', source_fingerprint: 'f1' }),
      row({ id: 3, user_id: 'user-5', source_url: 'https://x.example/b' }),
    ]

    expect(buildCollapseGroups(rows, null)).toEqual([{ canonicalId: 1, loserIds: [2, 3] }])
  })

  it('leaves recipes without a duplicate alone', () => {
    const rows = [
      row({ id: 1, user_id: 'user-4', source_url: 'https://a.example/1' }),
      row({ id: 2, user_id: 'user-4' }),
      row({ id: 3, user_id: 'user-3' }),
    ]

    expect(buildCollapseGroups(rows, MAIN)).toEqual([])
  })
})

describe('buildCollapseGroups — the canonical row (decision Q2)', () => {
  it("keeps the main account's copy even when another is older", () => {
    const rows = [
      row({ id: 1, user_id: 'user-4', source_url: 'https://a.example/x' }),
      row({ id: 2, user_id: MAIN, source_url: 'https://a.example/x' }),
      row({ id: 3, user_id: 'user-3', source_url: 'https://a.example/x' }),
    ]

    expect(buildCollapseGroups(rows, MAIN)).toEqual([{ canonicalId: 2, loserIds: [1, 3] }])
  })

  it('keeps the oldest copy when the main account has none', () => {
    const rows = [
      row({ id: 1, user_id: 'user-4', source_url: 'https://a.example/x', created_at: '2026-03-01T00:00:00Z' }),
      row({ id: 2, user_id: 'user-3', source_url: 'https://a.example/x', created_at: '2026-02-01T00:00:00Z' }),
    ]

    expect(buildCollapseGroups(rows, MAIN)).toEqual([{ canonicalId: 2, loserIds: [1] }])
  })

  it("keeps the main account's oldest copy when it has several", () => {
    const rows = [
      row({ id: 1, user_id: MAIN, source_url: 'https://www.facebook.com/groups/a/posts/9', created_at: '2026-03-01T00:00:00Z' }),
      row({ id: 2, user_id: MAIN, source_url: 'https://www.facebook.com/groups/77/posts/9', created_at: '2026-02-01T00:00:00Z' }),
      row({ id: 3, user_id: 'user-4', source_url: 'https://www.facebook.com/groups/a/posts/9', created_at: '2026-01-01T00:00:00Z' }),
    ]

    expect(buildCollapseGroups(rows, MAIN)).toEqual([{ canonicalId: 2, loserIds: [1, 3] }])
  })
})
