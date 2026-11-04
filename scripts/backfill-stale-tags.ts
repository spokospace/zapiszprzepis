// One-off, repeatable backfill for public recipes saved before the title-pattern
// and "szybkie" tag rules existed: they carry no tags although their title (or
// their stored times) already earns one. Re-runs the deterministic part of
// resolveTags only — no LLM, no re-scraping, no title change — and ADDS those
// tags to recipes that have none. Recipes that already have a tag, and recipes
// that match no rule, are left alone.
//
//   pnpm backfill:stale-tags            # preview, writes nothing
//   pnpm backfill:stale-tags --apply    # write the changes
import { createClient } from '@supabase/supabase-js'
import { staleTagsFor } from '@/lib/recipe-tags'

const apply = process.argv.includes('--apply')

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Only what the public site shows: hidden recipes are excluded by the view.
  const { data: publicRows, error: publicError } = await supabase.from('public_recipes').select('id')
  if (publicError || !publicRows) {
    console.error(`✗ Query failed (public_recipes): ${publicError?.message}`)
    process.exit(1)
  }
  const publicIds = new Set(publicRows.map((r) => r.id))

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, title, tags, prep_time_minutes, cook_time_minutes, total_time_minutes')
    .order('id')
  if (error || !recipes) {
    console.error(`✗ Query failed (recipes): ${error?.message}`)
    process.exit(1)
  }

  const plans = recipes
    .filter((r) => publicIds.has(r.id))
    .map((r) => ({
      id: r.id,
      title: r.title,
      tags: staleTagsFor({
        title: r.title,
        tags: r.tags,
        prepTimeMinutes: r.prep_time_minutes,
        cookTimeMinutes: r.cook_time_minutes,
        totalTimeMinutes: r.total_time_minutes,
      }),
    }))
    .filter((p) => p.tags.length > 0)

  console.log(`${apply ? 'Updating' : 'Preview of'} ${plans.length} tagless public recipe(s) that gain tags.\n`)
  for (const p of plans) console.log(`#${p.id} ${p.title}  → [${p.tags.join(', ')}]`)

  if (!apply) {
    console.log('\nPreview only — rerun with --apply to write.')
    return
  }

  let written = 0
  for (const p of plans) {
    // Guarded on the empty array, so a row tagged since the read is never touched.
    const { data: updated, error: updateError } = await supabase
      .from('recipes')
      .update({ tags: p.tags })
      .eq('id', p.id)
      .eq('tags', '{}')
      .select('id')
    if (updateError) console.error(`  ✗ ${p.id}: ${updateError.message}`)
    else written += updated?.length ?? 0
  }
  console.log(`\n✓ Done. Written: ${written} of ${plans.length}.`)
}

main().catch((err: Error) => {
  console.error(`✗ Backfill failed: ${err.message}`)
  process.exit(1)
})
