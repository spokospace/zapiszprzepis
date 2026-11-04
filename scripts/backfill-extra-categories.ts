// One-off backfill for extra categories (issue #689, slice 2): asks the labelling model
// which further category lists an EXISTING recipe belongs in. The primary category is
// never read for change and never written; recipes whose taxonomy staff fixed by hand
// (taxonomy_locked_at) and recipes that already have extras are skipped, so a re-run
// only touches what is left.
//
//   pnpm backfill:extra-categories --precision-check   # READ-ONLY review sample (~30), nothing written
//   pnpm backfill:extra-categories                     # dry run: classify everything, print, write nothing
//   pnpm backfill:extra-categories --apply             # write (owner's go only: production data change)
//
// Options: --limit N (stop after N classified recipes), --after ID (resume after a recipe id),
//          --sample N (precision-check size, default 30).
//
// Order of work: run --precision-check, review the table with the owner, then --apply.
// The migration 20261104100000 must be applied first (the column does not exist before it).
import { createClient } from '@supabase/supabase-js'
import { classifyExtraCategories, pickPrecisionSample } from '@/lib/extra-categories'
import { categoryLabel } from '@/lib/recipe-categories'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const value = (name: string): number | null => {
  const i = args.indexOf(name)
  const n = i >= 0 ? Number(args[i + 1]) : NaN
  return Number.isInteger(n) && n >= 0 ? n : null
}

const precisionCheck = flag('--precision-check')
const apply = flag('--apply')
const limit = value('--limit')
const after = value('--after') ?? 0
const sampleSize = value('--sample') ?? 30
const PAGE = 500

interface Row {
  id: number
  slug: string
  title: string
  category: string
  ingredients: unknown
  steps: unknown
}

async function main(): Promise<void> {
  if (precisionCheck && apply) {
    console.error('✗ --precision-check is read-only and cannot be combined with --apply')
    process.exit(1)
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.OPENAI_API_KEY
  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // Candidates: not locked, no extras yet. Paged by id so a resume is `--after <last id>`.
  const candidates: Row[] = []
  for (let from = after; ; ) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, slug, title, category, ingredients, steps')
      .is('taxonomy_locked_at', null)
      .eq('extra_categories', '{}')
      .gt('id', from)
      .order('id')
      .limit(PAGE)
    if (error) {
      console.error(`✗ Query failed: ${error.message}`)
      process.exit(1)
    }
    candidates.push(...(data as Row[]))
    if (data.length < PAGE) break
    from = data[data.length - 1].id
  }

  const work = precisionCheck ? pickPrecisionSample(candidates, sampleSize) : candidates
  const mode = precisionCheck ? 'PRECISION CHECK (read-only)' : apply ? 'APPLY' : 'DRY RUN'
  console.log(`${mode}: ${work.length} of ${candidates.length} candidate recipe(s).\n`)

  let classified = 0
  let withExtras = 0
  let written = 0
  const table: string[] = ['| id | title | primary | extras |', '|---|---|---|---|']

  for (const r of work) {
    if (limit != null && classified >= limit) break
    let extras: string[]
    try {
      extras = await classifyExtraCategories(
        { title: r.title, category: r.category, ingredients: r.ingredients, steps: r.steps },
        { fetch, apiKey },
      )
    } catch (error) {
      console.warn(`#${r.id} ${r.title}: classification failed (${error instanceof Error ? error.message : error}), skipped`)
      continue
    }
    classified++
    if (extras.length > 0) withExtras++
    table.push(`| ${r.id} | ${r.title.replace(/\|/g, '/')} | ${categoryLabel(r.category)} | ${extras.map(categoryLabel).join(', ') || '—'} |`)

    if (apply && extras.length > 0) {
      // Only the extras column, and only while the row is still unlocked and unextended.
      const { data, error } = await supabase
        .from('recipes')
        .update({ extra_categories: extras })
        .eq('id', r.id)
        .is('taxonomy_locked_at', null)
        .eq('extra_categories', '{}')
        .select('id')
      if (error) {
        console.error(`✗ #${r.id}: ${error.message}`)
        process.exit(1)
      }
      if (data && data.length > 0) written++
    }
  }

  console.log(table.join('\n'))
  const share = classified ? Math.round((withExtras / classified) * 100) : 0
  console.log(`\nClassified ${classified}, with extras ${withExtras} (${share}%)${apply ? `, written ${written}` : ', nothing written'}.`)
  if (precisionCheck) console.log('Review the table with the owner before running with --apply.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
