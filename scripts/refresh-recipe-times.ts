import { createClient } from '@supabase/supabase-js'
import { Inngest } from 'inngest'

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const inngestEventKey = process.env.INNGEST_EVENT_KEY

  if (!supabaseUrl) {
    console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL w .env.local')
    process.exit(1)
  }
  if (!serviceRoleKey) {
    console.error('✗ Brak SUPABASE_SERVICE_ROLE_KEY w .env.local')
    process.exit(1)
  }
  if (!inngestEventKey) {
    console.error('✗ Brak INNGEST_EVENT_KEY w .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, source_url, user_id, source_type, prep_time_minutes, cook_time_minutes, total_time_minutes')
    .or('prep_time_minutes.is.null,cook_time_minutes.is.null,total_time_minutes.is.null')

  if (error) {
    console.error(`✗ Query failed: ${error.message}`)
    process.exit(1)
  }
  if (!recipes || recipes.length === 0) {
    console.log('✓ Nothing to refresh — all recipes have full time data.')
    return
  }

  console.log(`Found ${recipes.length} recipe(s) with missing time fields.`)

  const inngest = new Inngest({ id: 'zapiszprzepis' })

  for (const r of recipes) {
    if (!r.source_url) {
      console.log(`  skip recipe ${r.id}: no source_url`)
      continue
    }

    const { data: share } = await supabase
      .from('recipe_shares')
      .select('id')
      .eq('recipe_id', r.id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!share) {
      console.log(`  skip recipe ${r.id}: no linked share`)
      continue
    }

    await inngest.send({
      name: 'recipe/extract',
      data: {
        shareId: share.id,
        sharedUrl: r.source_url,
        userId: r.user_id,
        sourceType: r.source_type,
      },
    })
    console.log(`  ✓ Triggered refresh for recipe ${r.id} (${r.source_url})`)
  }

  console.log(`✓ Done. Check Inngest dashboard for run progress.`)
}

main().catch((err: Error) => {
  console.error(`✗ Refresh failed: ${err.message}`)
  process.exit(1)
})
