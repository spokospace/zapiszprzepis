// Re-extract recipes in place (the "Odśwież przepis" path, forced) — for recipes
// saved from a bad scrape (#557). Dry run by default; `--run` queues, one event
// every `--every` seconds so the scrapers and the model are not hit all at once.
//
//   pnpm tsx scripts/refresh-recipes.ts dip-biala-pizza pizza-pasta [--run] [--every 10]
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { Inngest } from 'inngest'
import { queueRecipeRefresh } from '../src/lib/recipe-refresh'

async function main() {
  const { values, positionals: slugs } = parseArgs({
    allowPositionals: true,
    options: { run: { type: 'boolean', default: false }, every: { type: 'string', default: '10' } },
  })
  const everySeconds = Number(values.every)
  if (slugs.length === 0) {
    console.error('No slugs given.')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const inngestEventKey = process.env.INNGEST_EVENT_KEY
  if (!supabaseUrl || !serviceRoleKey || !inngestEventKey) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and INNGEST_EVENT_KEY are needed in .env.local')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const inngest = new Inngest({ id: 'zapiszprzepis', eventKey: inngestEventKey })

  const { data: recipes, error } = await supabase.from('recipes').select('slug, user_id, source_url').in('slug', slugs)
  if (error) {
    console.error(`✗ Query failed: ${error.message}`)
    process.exit(1)
  }
  const bySlug = new Map((recipes ?? []).map((r) => [r.slug, r]))
  const missing = slugs.filter((s) => !bySlug.has(s))
  if (missing.length) console.warn(`⚠ not found: ${missing.join(', ')}`)

  const todo = slugs.flatMap((s) => bySlug.get(s) ?? [])
  console.log(`${values.run ? 'Queueing' : 'Would queue'} ${todo.length} refresh(es), one every ${everySeconds} s.`)
  for (const r of todo) {
    if (!r.source_url) {
      console.warn(`⚠ ${r.slug}: no source_url, skipped`)
      continue
    }
    console.log(`${values.run ? '→' : '·'} ${r.slug}  (${r.source_url})`)
    if (!values.run) continue
    const shareId = await queueRecipeRefresh(supabase, inngest, { userId: r.user_id, sourceUrl: r.source_url })
    if (shareId == null) console.error(`✗ ${r.slug}: share insert failed`)
    await new Promise((resolve) => setTimeout(resolve, everySeconds * 1000))
  }
  console.log(values.run ? '✓ Queued. Watch recipe_shares.status for the results.' : 'Dry run — add --run to queue.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
