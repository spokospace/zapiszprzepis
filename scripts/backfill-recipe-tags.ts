// One-off backfill for recipes saved before tags and the distinguishing note
// existed: sentence-case the title, write the note (recipes.description) and
// the tags — with the same labelling call new recipes go through. Works from
// the stored recipe: no re-scraping. The slug is left alone so recipe URLs
// stay stable.
//
//   pnpm backfill:recipe-tags            # preview, writes nothing
//   pnpm backfill:recipe-tags --apply    # write the changes
import { createClient } from '@supabase/supabase-js'
import { labelRecipe } from '@/lib/recipe-labeling'

const apply = process.argv.includes('--apply')

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.OPENAI_API_KEY
  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY w .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, user_id, title, description, ingredients, steps, category, prep_time_minutes, cook_time_minutes, total_time_minutes')
    .order('id')
  if (error || !recipes) {
    console.error(`✗ Query failed: ${error?.message}`)
    process.exit(1)
  }

  console.log(`${apply ? 'Updating' : 'Preview of'} ${recipes.length} recipe(s).\n`)

  for (const r of recipes) {
    const siblings = recipes.filter((o) => o.user_id === r.user_id && o.id !== r.id)
    const { title, description, tags } = await labelRecipe(
      {
        title: r.title,
        category: r.category,
        ingredients: r.ingredients,
        steps: r.steps,
        prepTimeMinutes: r.prep_time_minutes,
        cookTimeMinutes: r.cook_time_minutes,
        totalTimeMinutes: r.total_time_minutes,
      },
      siblings,
      { fetch, apiKey },
    )

    console.log(`#${r.id} ${r.title}${title !== r.title ? ` → ${title}` : ''}`)
    console.log(`     ${description ?? '(no note)'}  [${tags.join(', ')}]`)
    // Later recipes see this one's new note, so theirs can differ from it.
    r.title = title
    r.description = description

    if (apply) {
      const { error: updateError } = await supabase.from('recipes').update({ title, description, tags }).eq('id', r.id)
      if (updateError) console.error(`  ✗ ${r.id}: ${updateError.message}`)
    }
  }

  console.log(apply ? '\n✓ Done.' : '\nPreview only — rerun with --apply to write.')
}

main().catch((err: Error) => {
  console.error(`✗ Backfill failed: ${err.message}`)
  process.exit(1)
})
