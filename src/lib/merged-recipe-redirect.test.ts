import { describe, expect, it } from 'vitest'
import { mergedRecipeSlug } from './merged-recipe-redirect'

type Row = Record<string, unknown>

/** A client over two tables, answering .eq(column, value) filters with the first matching row. */
function makeClient(tables: { merged?: Row[]; recipes?: Row[]; deleted?: Row[] }) {
  const rows: Record<string, Row[]> = {
    recipes_merged_duplicates: tables.merged ?? [],
    public_recipes: tables.recipes ?? [],
    recipes_deleted_by_staff: tables.deleted ?? [],
  }
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

describe('mergedRecipeSlug — a recipe staff deleted with a redirect', () => {
  const deleted = [{ slug: 'zupa-stara', redirect_to_slug: 'zupa' }]

  it('lands on the redirect target', async () => {
    const client = makeClient({ deleted, recipes: [{ id: 1, slug: 'zupa' }] })

    expect(await mergedRecipeSlug(client, 'zupa-stara')).toBe('zupa')
  })

  it('is a 404 (null) when the target is hidden, since public_recipes no longer holds it', async () => {
    expect(await mergedRecipeSlug(makeClient({ deleted, recipes: [] }), 'zupa-stara')).toBeNull()
  })

  it('is a 404 (null) for a delete without a redirect', async () => {
    const client = makeClient({ deleted: [{ slug: 'zupa-stara', redirect_to_slug: null }], recipes: [{ id: 1, slug: 'zupa' }] })

    expect(await mergedRecipeSlug(client, 'zupa-stara')).toBeNull()
  })

  it('follows a target that was folded into another recipe afterwards', async () => {
    const client = makeClient({
      deleted,
      merged: [{ id: 7, slug: 'zupa', canonical_id: 8 }],
      recipes: [{ id: 8, slug: 'zupa-glowna' }],
    })

    expect(await mergedRecipeSlug(client, 'zupa-stara')).toBe('zupa-glowna')
  })
})
