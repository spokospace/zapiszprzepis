import { createClient } from '@supabase/supabase-js'
import { jsonLdServings } from '../src/lib/servings'

// Gives blog recipes saved before the servings column (migration
// 20261017200000_recipe_servings) the count their page states, by re-reading
// each page's schema.org JSON-LD recipeYield — the same deterministic parse the
// extraction uses, so no LLM call and no guess. A page without a JSON-LD yield,
// with conflicting Recipe yields, or no longer reachable keeps servings null and
// the recipe page simply shows no "na N porcji" line (it can still get one from
// "Odśwież przepis"). Facebook and YouTube recipes have no JSON-LD and are skipped.
//
// OPTIONAL and owner-gated: it writes production rows. Run only after the
// migration is applied. Dry run by default; pass --apply to write. Safe to run
// again: it only touches rows whose servings is still null.

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function pageHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
      signal: AbortSignal.timeout(15_000),
    })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, slug, source_url')
    .eq('source_type', 'web_blog')
    .is('servings', null)
    .not('source_url', 'is', null)
    .order('created_at', { ascending: true })
  if (error) {
    console.error(`✗ Query failed: ${error.message}`)
    process.exit(1)
  }

  const updates: { id: number; servings: number }[] = []
  for (const recipe of recipes ?? []) {
    const html = await pageHtml(recipe.source_url!)
    const servings = html ? jsonLdServings(html) : null
    if (servings == null) {
      console.log(`  – /przepis/${recipe.slug}: ${html ? 'no JSON-LD yield' : 'page unreachable'}`)
      continue
    }
    console.log(`  ✓ /przepis/${recipe.slug}: na ${servings}`)
    updates.push({ id: recipe.id, servings })
  }

  console.log(`${updates.length} of ${recipes?.length ?? 0} recipe(s) to update.`)
  if (!apply) {
    console.log('Dry run — pass --apply to write.')
    return
  }
  for (const u of updates) {
    const { error: e } = await supabase.from('recipes').update({ servings: u.servings }).eq('id', u.id).is('servings', null)
    if (e) console.error(`✗ recipe #${u.id}: ${e.message}`)
  }
  console.log('✓ Done.')
}

main()
