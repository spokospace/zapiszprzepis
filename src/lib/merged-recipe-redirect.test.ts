import { describe, expect, it } from 'vitest'
import { mergedRecipeSlug } from './merged-recipe-redirect'

type Row = Record<string, unknown>

/** A client over two tables, answering .eq(column, value) filters with the first matching row. */
function makeClient(tables: { merged?: Row[]; recipes?: Row[] }) {
  const rows: Record<string, Row[]> = { recipes_merged_duplicates: tables.merged ?? [], public_recipes: tables.recipes ?? [] }
  const from = (table: string) => {
    const filters: [string, unknown][] = []
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value])
        return chain
      },
      maybeSingle: async () => ({ data: rows[table].find((r) => filters.every(([c, v]) => r[c] === v)) ?? null, error: null }),
    }
    return chain
  }
  return { from } as never
}

describe('mergedRecipeSlug — where a merged duplicate’s link lands', () => {
  it('names the recipe the slug was folded into', async () => {
    const client = makeClient({
      merged: [{ id: 326, slug: 'salatka-z-mlodej-kapusty-2', canonical_id: 156 }],
      recipes: [{ id: 156, slug: 'salatka-z-mlodej-kapusty' }],
    })

    expect(await mergedRecipeSlug(client, 'salatka-z-mlodej-kapusty-2')).toBe('salatka-z-mlodej-kapusty')
  })

  it('follows a recipe folded again later', async () => {
    const client = makeClient({
      merged: [
        { id: 1, slug: 'placki-2', canonical_id: 2 },
        { id: 2, slug: 'placki-3', canonical_id: 3 },
      ],
      recipes: [{ id: 3, slug: 'placki' }],
    })

    expect(await mergedRecipeSlug(client, 'placki-2')).toBe('placki')
  })

  it('gives null for a slug never merged, or one whose recipe is gone', async () => {
    expect(await mergedRecipeSlug(makeClient({}), 'nie-ma')).toBeNull()
    expect(await mergedRecipeSlug(makeClient({ merged: [{ id: 1, slug: 'x', canonical_id: 9 }] }), 'x')).toBeNull()
  })
})
