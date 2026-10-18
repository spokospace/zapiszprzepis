import { describe, expect, it } from 'vitest'
import {
  classifyExisting,
  findExistingRecipeForUrl,
  findRecipeByYoutubeId,
  findSameRecipe,
  ingredientFingerprint,
  ingredientKey,
  ingredientsSubsume,
  sameIngredients,
} from './recipe-dedup'

// A set of five distinct names — the smallest that fingerprints (MIN_FINGERPRINT_NAMES).
const FIVE = [{ name: 'chleb' }, { name: 'jajka' }, { name: 'szynka' }, { name: 'ser' }, { name: 'masło' }]

describe('findSameRecipe — the preferred user’s own copy', () => {
  const NALESNIKI = { title: 'Naleśniki', ingredients: [{ name: 'mąka' }] }
  const recipeRow = (id: number, user_id: string) => ({
    id,
    user_id,
    slug: `nalesniki-${id}`,
    title: 'Naleśniki',
    category: 'sniadania',
    ingredients: [{ name: 'mąka' }],
  })

  /** A client that honours the user_id filter and the page limit, like the database. */
  function makeRecipesClient(rows: ReturnType<typeof recipeRow>[]) {
    return {
      from: () => {
        let owner: string | null = null
        const chain = {
          select: () => chain,
          eq: (_column: string, value: string) => {
            owner = value
            return chain
          },
          ilike: () => chain,
          limit: async (n: number) => ({ data: rows.filter((r) => owner == null || r.user_id === owner).slice(0, n) }),
        }
        return chain
      },
    } as never
  }

  it('finds it even when a common title fills the site-wide page with other users’ copies', async () => {
    const others = Array.from({ length: 60 }, (_, i) => recipeRow(i + 1, `user-${i + 10}`))
    const client = makeRecipesClient([...others, recipeRow(99, 'user-1')])

    expect(await findSameRecipe(client, null, NALESNIKI, 'user-1')).toMatchObject({ id: 99, user_id: 'user-1' })
  })

  it('falls back to anyone’s copy when the user has none', async () => {
    const client = makeRecipesClient([recipeRow(5, 'user-2')])

    expect(await findSameRecipe(client, null, NALESNIKI, 'user-1')).toMatchObject({ id: 5, user_id: 'user-2' })
  })
})

describe('ingredientKey / ingredientFingerprint', () => {
  it('is null for a set below the floor, order- and case-insensitive above it', () => {
    expect(ingredientKey([{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }])).toBeNull()
    expect(ingredientKey(FIVE)).toBe(ingredientKey([...FIVE].reverse()))
    expect(ingredientKey([{ name: 'Chleb' }, { name: 'JAJKA' }, { name: 'szynka' }, { name: 'ser' }, { name: ' masło ' }])).toBe(
      ingredientKey(FIVE),
    )
  })

  it('hashes equal sets to the same fingerprint and is null below the floor', async () => {
    expect(await ingredientFingerprint([{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }])).toBeNull()
    const fp = await ingredientFingerprint(FIVE)
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
    expect(await ingredientFingerprint([...FIVE].reverse())).toBe(fp)
    // One swapped ingredient is a different set — a different fingerprint.
    expect(await ingredientFingerprint([...FIVE.slice(1), { name: 'cebula' }])).not.toBe(fp)
  })
})

describe('findSameRecipe — same ingredient set, whatever the title', () => {
  type Row = { id: number; user_id: string; slug: string; title: string; category: string; ingredient_fingerprint: string | null }
  /** A client that filters recipes by the eq() columns and the ilike title, like the database. */
  function client(rows: Row[]) {
    return {
      from: () => {
        const eqs: Record<string, string> = {}
        let title: string | null = null
        const chain = {
          select: () => chain,
          eq: (column: string, value: string) => ((eqs[column] = value), chain),
          ilike: (_c: string, value: string) => ((title = value), chain),
          limit: async (n: number) => ({
            data: rows
              .filter((r) => (eqs.user_id == null || r.user_id === eqs.user_id))
              .filter((r) => (eqs.ingredient_fingerprint == null || r.ingredient_fingerprint === eqs.ingredient_fingerprint))
              .filter((r) => (title == null || r.title.toLowerCase() === title.toLowerCase()))
              .slice(0, n),
          }),
        }
        return chain
      },
    } as never
  }

  it('links a differently-titled recipe with the identical ingredient set (#835/#836)', async () => {
    const fp = (await ingredientFingerprint(FIVE))!
    const rows: Row[] = [{ id: 835, user_id: 'u1', slug: 'kanapki', title: 'Kanapki z jajkiem i szynką', category: 'przekaski', ingredient_fingerprint: fp }]
    const incoming = { title: 'Zapiekanka z szynką i serem', ingredients: FIVE }

    expect(await findSameRecipe(client(rows), null, incoming, 'u1')).toMatchObject({ id: 835 })
  })

  it('does not match on a set below the fingerprint floor', async () => {
    const small = [{ name: 'jajka' }, { name: 'masło' }, { name: 'sól' }]
    const rows: Row[] = [{ id: 1, user_id: 'u1', slug: 'jajecznica', title: 'Jajecznica', category: 'sniadania', ingredient_fingerprint: null }]

    expect(await findSameRecipe(client(rows), null, { title: 'Omlet', ingredients: small }, 'u1')).toBeNull()
  })
})

describe('sameIngredients', () => {
  it('ignores order, casing, spacing and repeats', () => {
    expect(sameIngredients([{ name: 'Mąka' }, { name: 'masło' }], [{ name: 'masło ' }, { name: 'mąka' }, { name: 'Masło' }])).toBe(true)
  })

  it('tells apart a variant that adds or swaps an ingredient', () => {
    expect(sameIngredients([{ name: 'mąka' }, { name: 'masło' }], [{ name: 'mąka' }, { name: 'margaryna' }])).toBe(false)
    expect(sameIngredients([{ name: 'mąka' }], [{ name: 'mąka' }, { name: 'cukier' }])).toBe(false)
  })
})

describe('ingredientsSubsume — one recipe extracted twice at different completeness', () => {
  // The real miodownik dup: the Facebook caption caught only the cake base; the
  // fuller post added the kasza-manna cream the title names.
  const base = [{ name: 'mąka' }, { name: 'jajka' }, { name: 'cukier' }, { name: 'miód' }, { name: 'soda oczyszczona' }, { name: 'margaryna lub masło' }]
  const full = [...base, { name: 'mleko' }, { name: 'kasza manna' }]

  it('matches when the shorter list is contained in the longer, either way round', () => {
    expect(ingredientsSubsume(base, full)).toBe(true)
    expect(ingredientsSubsume(full, base)).toBe(true)
  })

  it('ignores casing, spacing and repeats like sameIngredients', () => {
    expect(ingredientsSubsume([{ name: 'Mąka' }, { name: 'Cukier ' }, { name: 'Jajka' }], [{ name: 'mąka' }, { name: 'cukier' }, { name: 'jajka' }, { name: 'masło' }])).toBe(true)
  })

  it('rejects a variant that swaps an ingredient (not a subset)', () => {
    expect(ingredientsSubsume([{ name: 'mąka' }, { name: 'masło' }, { name: 'cukier' }], [{ name: 'mąka' }, { name: 'margaryna' }, { name: 'cukier' }, { name: 'jajka' }])).toBe(false)
  })

  it('refuses a STRICT subset from a near-empty list, however well it is contained', () => {
    expect(ingredientsSubsume([{ name: 'mąka' }, { name: 'cukier' }], [{ name: 'mąka' }, { name: 'cukier' }, { name: 'jajka' }, { name: 'masło' }])).toBe(false)
  })

  it('still matches two equal short lists at any size (keeps the old same-ingredients linking)', () => {
    expect(ingredientsSubsume([{ name: ' mąka' }], [{ name: 'Mąka' }])).toBe(true)
    expect(ingredientsSubsume([{ name: 'mąka' }, { name: 'kefir' }], [{ name: 'kefir' }, { name: 'mąka' }])).toBe(true)
  })
})

describe('classifyExisting — whose recipe a link already is', () => {
  it('is nobody’s when nothing matches', () => {
    expect(classifyExisting({ ownMatch: false, globalMatch: false })).toBe('none')
  })

  it('is the user’s own when they saved it, whatever else matches', () => {
    expect(classifyExisting({ ownMatch: true, globalMatch: false })).toBe('own')
    expect(classifyExisting({ ownMatch: true, globalMatch: true })).toBe('own')
  })

  it('is someone else’s when only a site-wide row matches', () => {
    expect(classifyExisting({ ownMatch: false, globalMatch: true })).toBe('other')
  })
})

type Call = { table: string; method: string; args: unknown[] }

/** A client whose lookups answer from `rows` (one row per table) and record every filter. */
function makeClient(rows: Record<string, unknown>) {
  const calls: Call[] = []
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'like', 'limit', 'order']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return chain
      }
    }
    chain.maybeSingle = async () => ({ data: rows[table] ?? null, error: null })
    return chain
  }
  return { client: { from } as never, calls }
}

const USER = 'user-1'

describe('findExistingRecipeForUrl — one recipe per link across the site', () => {
  it('reports the user’s own recipe without looking further', async () => {
    const { client, calls } = makeClient({ recipes: { id: 1, slug: 'placki' } })

    expect(await findExistingRecipeForUrl(client, USER, 'https://example.com/placki/')).toEqual({
      status: 'completed',
      slug: 'placki',
      normalizedUrl: 'https://example.com/placki',
    })
    expect(calls.some((c) => c.table === 'public_recipes')).toBe(false)
  })

  it('reports someone else’s recipe for the same link, read through public_recipes', async () => {
    const { client, calls } = makeClient({ public_recipes: { id: 7, slug: 'tiramisu' } })

    expect(await findExistingRecipeForUrl(client, USER, 'https://example.com/tiramisu?fbclid=abc')).toEqual({
      status: 'other',
      recipeId: 7,
      slug: 'tiramisu',
      normalizedUrl: 'https://example.com/tiramisu',
    })
    // The view has no user_id; only the own lookup is scoped to the user.
    expect(calls.filter((c) => c.table === 'public_recipes' && c.method === 'eq')).toEqual([
      { table: 'public_recipes', method: 'eq', args: ['source_url', 'https://example.com/tiramisu'] },
    ])
  })

  it('matches a Facebook group post under any group name through the LIKE pattern', async () => {
    const { client, calls } = makeClient({ public_recipes: { id: 9, slug: 'paella' } })

    const result = await findExistingRecipeForUrl(client, USER, 'https://www.facebook.com/groups/kuchnia/posts/123/')

    expect(result).toMatchObject({ status: 'other', recipeId: 9 })
    expect(calls).toContainEqual({
      table: 'public_recipes',
      method: 'like',
      args: ['source_url', 'https://www.facebook.com/groups/%/posts/123'],
    })
  })

  it('falls back to the user’s pending share, then to a new link', async () => {
    const pending = makeClient({ recipe_shares: { id: 3 } })
    expect(await findExistingRecipeForUrl(pending.client, USER, 'https://example.com/x')).toMatchObject({ status: 'pending' })

    const fresh = makeClient({})
    expect(await findExistingRecipeForUrl(fresh.client, USER, 'https://example.com/x')).toMatchObject({ status: 'new' })
  })
})

describe('findRecipeByYoutubeId — the same film under another link', () => {
  it('matches any recipe carrying the video id for a video share', async () => {
    const { client, calls } = makeClient({ recipes: { id: 368, slug: 'babeczki-lesny-mech' } })

    expect(await findRecipeByYoutubeId(client, 'dQw4w9WgXcQ', { fromVideo: true })).toMatchObject({ id: 368 })
    expect(calls.filter((c) => c.method === 'eq')).toEqual([{ table: 'recipes', method: 'eq', args: ['youtube_id', 'dQw4w9WgXcQ'] }])
  })

  it("matches only the video's own recipe for a page that embeds it", async () => {
    const { client, calls } = makeClient({})

    expect(await findRecipeByYoutubeId(client, 'dQw4w9WgXcQ', { fromVideo: false })).toBeNull()
    expect(calls).toContainEqual({ table: 'recipes', method: 'eq', args: ['source_type', 'youtube'] })
  })
})
