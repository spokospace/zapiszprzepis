import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ingredientFingerprint } from '../src/lib/recipe-dedup'

// Gives existing recipes the ingredient-set fingerprint the pipeline now stores
// (see the recipes_ingredient_fingerprint migration), computed from each
// recipe's own ingredients — no network, unlike the source-fingerprint
// backfill. Dry run by default; pass --apply to write. Only rows that still
// have no fingerprint and whose ingredient set is large enough to fingerprint
// (see MIN_FINGERPRINT_NAMES) are touched.

const PAGE = 1000

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) return all
  }
}

type Row = { id: number; slug: string; ingredients: { name: string }[]; ingredient_fingerprint: string | null }

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const recipes = await fetchAll<Row>((from, to) =>
    supabase
      .from('recipes')
      .select('id, slug, ingredients, ingredient_fingerprint')
      .is('ingredient_fingerprint', null)
      .order('id')
      .range(from, to),
  )

  const updates: { id: number; slug: string; fingerprint: string }[] = []
  for (const recipe of recipes) {
    const fingerprint = await ingredientFingerprint(Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    if (fingerprint) updates.push({ id: recipe.id, slug: recipe.slug, fingerprint })
  }

  console.log(`${updates.length} of ${recipes.length} unfingerprinted recipe(s) to fingerprint.`)
  if (!apply) {
    console.log('Dry run — pass --apply to write.')
    return
  }
  for (const u of updates) {
    const { error } = await supabase.from('recipes').update({ ingredient_fingerprint: u.fingerprint }).eq('id', u.id)
    if (error) console.error(`✗ recipe #${u.id} (${u.slug}): ${error.message}`)
  }
  console.log('✓ Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
